# self-host

panel + scrubber side-by-side. operators bring their own ingress.

```bash
cd deploy
docker compose up -d

curl http://localhost:3015/         # panel
curl http://localhost:3017/health   # scrubber
```

before going live:

1. `openssl rand -hex 32` → set `SCRUBBER_REVERSAL_KEY` in `docker-compose.yml`.
2. point your ingress (nginx/traefik/caddy/cloudflare tunnel) at `panel:3015` and (optionally) `scrubber:3017`.
3. set `PANEL_PUBLIC_URL` env if your panel is not at `localhost`.

scrubber assumes it lives at `../../scrubber-proxy` relative to `deploy/`. Clone https://github.com/UltraInstinct0x/panel and (for now) copy `scrubber-proxy/` into a sibling dir on your host. It will graduate to its own repo at `github.com/UltraInstinct0x/scrubber-proxy` once it stabilizes.

technical-pool units fail closed: if `SCRUBBER_URL` is set and scrubber is unreachable, panel returns `503 scrubber_unavailable` rather than serving an unsanitized unit.
