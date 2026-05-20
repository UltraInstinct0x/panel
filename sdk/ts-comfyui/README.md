# panel-comfyui-adapter

first-party adapter that drives a [ComfyUI](https://github.com/comfyanonymous/ComfyUI) instance, captures generated outputs, and emits them as `media_origin` / `media_quality` units to panel.

## why an adapter (not just sdk userland)

ComfyUI's HTTP API is request → polled queue → websocket progress events → `/view` download. There's enough glue (websocket lifecycle, prompt id correlation, multi-output collection, byte hashing) to be worth packaging as a dedicated adapter rather than copy-pasted recipe code.

REST-shaped providers (Replicate, ElevenLabs) ship as reference adapters in `panel-replicate-adapter` and `panel-elevenlabs-adapter` — those are 30-line copy-paste patterns.

## quickstart

```ts
import { createClient } from 'panel-sdk';
import { createComfyAdapter } from 'panel-comfyui-adapter';

const panel = createClient({ siteKey: process.env.PANEL_SITE_KEY!, secret: process.env.PANEL_SECRET! });
const comfy = createComfyAdapter({ comfyUrl: 'http://127.0.0.1:8188', panelClient: panel });

const r = await comfy.submit({ workflow: './workflow_api.json', prompt: 'a pirate galleon at sunset' });
console.log(r.promptId, r.units.map(u => u.id));
```

## workflow JSON

ComfyUI workflows come in two shapes: the canvas `.json` (UI graph) and the **API format** (what `/prompt` accepts). Export from ComfyUI: `Settings → Enable Dev mode Options → Save (API Format)`. Pass either an object, a local path, an http(s) URL, or an inline JSON string.

## threat model

ComfyUI's HTTP API is **unauthenticated by default**. The constructor will throw if `comfyUrl` looks public and no `auth` is set. Allowed without auth:

- `localhost`, `127.0.0.1`, `::1`, `0.0.0.0`
- RFC1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
- Tailscale CGNAT (`100.64.0.0/10`) and `*.ts.net`
- Link-local `169.254.0.0/16`, `*.local`

For public hostnames behind a reverse proxy with bearer auth:

```ts
createComfyAdapter({
  comfyUrl: 'https://comfy.example.com',
  panelClient: panel,
  auth: { header: 'Authorization', value: `Bearer ${process.env.COMFY_TOKEN}` },
});
```

## composes with v6a SDK

This package depends on `panel-sdk` via `file:../ts`. **Merge order: the v6a SDK PR must merge first.**

## status

- ships in V6b
- `submit` + `healthcheck` only; no batch queue helpers yet
- audio outputs are forwarded as `type: 'audio'` for forward-compat but panel ingest may currently reject (audio_origin/audio_quality unit types deferred)
