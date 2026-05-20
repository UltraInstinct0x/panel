"""
V5 — Modal serverless dev media generator for panel.

Spins up a serverless GPU function that runs SDXL-Turbo for fast image
generation. Outputs are written to a Modal Volume + served via a small
FastAPI endpoint. Driver script (scripts/run-dev-gen.ts) calls the endpoint,
hashes the output, and emits to panel as `media_quality` + `media_origin`
(truth=ai-generated) units.

Video deferred to V5b — serverless text-to-video has 60s+ cold starts and
$0.05+/clip economics; not worth shipping until we know the unit pulls.

Deploy:
  modal deploy infra/modal/dev_gen.py

Endpoints (after deploy):
  POST  https://<ws>--panel-dev-gen-generate.modal.run
        { "prompt": "a cat in a hat", "n": 1, "seed": null }
        -> { "items": [{ "image_id": "...", "url": "...", "prompt": "..." }] }
  GET   https://<ws>--panel-dev-gen-fetch.modal.run/<image_id>
        -> raw PNG bytes (for hotlink into honeypots / direct rater render)

Auth:
  Set DEV_GEN_TOKEN in modal secret `panel-dev-gen` and pass it as
  `Authorization: Bearer <token>` on the generate endpoint. Fetch is public
  (image IDs are 32-char random; no enumeration).
"""

from __future__ import annotations

import io
import os
import secrets
import time
from typing import Optional

import modal

APP_NAME = "panel-dev-gen"
VOLUME_NAME = "panel-dev-gen-outputs"
SECRET_NAME = "panel-dev-gen"

# ---- image -----------------------------------------------------------------

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "torch==2.4.1",
        "diffusers==0.31.0",
        "transformers==4.46.0",
        "accelerate==1.0.1",
        "fastapi[standard]==0.115.0",
        "Pillow==10.4.0",
    )
    .env({"HF_HOME": "/cache/hf", "TRANSFORMERS_CACHE": "/cache/hf"})
)

app = modal.App(APP_NAME, image=image)
volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)
secret = modal.Secret.from_name(SECRET_NAME, required_keys=[])  # token optional

MODEL_ID = "stabilityai/sdxl-turbo"
OUTPUTS_DIR = "/outputs"

# ---- model class -----------------------------------------------------------


@app.cls(
    gpu="A10G",
    volumes={"/cache": modal.Volume.from_name("panel-dev-gen-cache", create_if_missing=True),
             OUTPUTS_DIR: volume},
    secrets=[secret],
    scaledown_window=300,  # keep warm 5min after last request
    timeout=600,
)
class SDXLTurbo:
    @modal.enter()
    def load(self):
        import torch
        from diffusers import AutoPipelineForText2Image

        self.pipe = AutoPipelineForText2Image.from_pretrained(
            MODEL_ID,
            torch_dtype=torch.float16,
            variant="fp16",
        )
        self.pipe.to("cuda")
        self.pipe.set_progress_bar_config(disable=True)

    @modal.method()
    def generate(self, prompt: str, n: int = 1, seed: Optional[int] = None) -> list[dict]:
        import torch
        from PIL import Image  # noqa: F401  (used implicitly via pipe output)

        n = max(1, min(int(n), 4))
        items = []
        for i in range(n):
            generator = None
            if seed is not None:
                generator = torch.Generator(device="cuda").manual_seed(int(seed) + i)
            out = self.pipe(
                prompt=prompt,
                num_inference_steps=2,
                guidance_scale=0.0,
                generator=generator,
            )
            img = out.images[0]
            image_id = secrets.token_hex(16)
            path = f"{OUTPUTS_DIR}/{image_id}.png"
            img.save(path, format="PNG")
            items.append({
                "image_id": image_id,
                "prompt": prompt,
                "model": MODEL_ID,
                "created_at": int(time.time()),
            })
        # commit volume so fetch_image can read it
        volume.commit()
        return items


# ---- web app ---------------------------------------------------------------


@app.function(secrets=[secret], volumes={OUTPUTS_DIR: volume}, timeout=600)
@modal.asgi_app(label="panel-dev-gen")
def web():
    from fastapi import FastAPI, HTTPException, Header
    from fastapi.responses import Response

    api = FastAPI()

    @api.post("/generate")
    def generate(payload: dict, authorization: str = Header(default="")):
        expected = os.environ.get("DEV_GEN_TOKEN", "").strip()
        if expected:
            got = authorization.removeprefix("Bearer ").strip() if authorization else ""
            if got != expected:
                raise HTTPException(401, "bad token")

        prompt = (payload.get("prompt") or "").strip()
        if not prompt or len(prompt) > 1000:
            raise HTTPException(400, "prompt 1..1000 chars required")
        n = int(payload.get("n", 1))
        seed = payload.get("seed")

        items = SDXLTurbo().generate.remote(prompt=prompt, n=n, seed=seed)
        base = "https://ultrainstinct0x--panel-dev-gen.modal.run"
        for it in items:
            it["url"] = f"{base}/img/{it['image_id']}"
        return {"items": items}

    @api.get("/img/{image_id}")
    def fetch_image(image_id: str):
        if not image_id or not image_id.replace("-", "").isalnum() or len(image_id) > 64:
            raise HTTPException(400, "bad image_id")
        path = f"{OUTPUTS_DIR}/{image_id}.png"
        try:
            with open(path, "rb") as f:
                data = f.read()
        except FileNotFoundError:
            raise HTTPException(404, "not found")
        return Response(content=data, media_type="image/png")

    @api.get("/health")
    def health():
        return {"ok": True}

    return api
