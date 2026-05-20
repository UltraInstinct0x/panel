# panel

[![ci](https://github.com/UltraInstinct0x/panel/actions/workflows/ci.yml/badge.svg)](https://github.com/UltraInstinct0x/panel/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

a captcha you don't hate. visitors prove they're human by judging one piece of agent output. the judgment becomes preference data the operator keeps.

recaptcha trains google's self-driving cars on your visitors. panel trains your own systems.

live: https://panel.goku.codes

## the insight (D12 — pool split)

the existential risk for any "taste captcha" is a flagship LLM that can solve every unit faster than a human. the fix is architectural, not cryptographic — DRM for plain text on the open web is a dead end.

so the unit pool is split by who-wins-the-race:

| pool | unit shape | who wins | where it runs |
|---|---|---|---|
| public captcha | taste, sarcasm, dub-sync, voice naturalness, cultural recency, perception, sincere-vs-sarcastic, AI-vs-real detection | human (or ambiguous) | `/demo/gate`, drive-by raters, anonymous |
| paid rater | code skill_diff, step_validity, pairwise traces, hallucination calls | flagship wins easy | dogfood loop, T2+ trust raters, internal harness |

technical units never touch anonymous raters. that's the whole wedge. hCaptcha can't pivot to taste-units without rebuilding their gold-seed quality model from scratch.

## the other defenses (D13)

even taste degrades if a bot brute-forces. layers:

1. behavioral floor — mouse / scroll / focus / dwell entropy. bot must fake distributions, not just answer.
2. engagement window — 2.5–4s minimum, variance check.
3. interaction-required hard tiers — drag-to-rank, highlight-the-span, drag-onto-moving-target.
4. honeypot units — quietly seeded units where the obvious-LLM-answer is wrong by design. flunking = flagged.
5. opaque scoring — token issues unconditionally, the gold-agreement score resolves hours later. bot can't tight-loop the verifier.

## what's in this repo

a next.js 14 app. sqlite persistence. iframe SDK.

| route | what it is |
|---|---|
| `/` | landing |
| `/demo/gate` | fake operator signup form embedding the widget |
| `/widget` | widget standalone (iframe target) |
| `/embed` | iframe SDK with postMessage handshake |
| `/dashboard` | rater log, trust score, agreement rate |
| `/operator` | operator key, embed snippet, dataset preview |
| `/api/units/next` | returns one unit from the public taste pool (site_key affinity: `pk_img_*` prefers `ai_output_rating` with images) |
| `/api/units/ingest` | operator pushes AI outputs into the queue (HMAC, per-site secret) |
| `/api/units/score` | operator reads aggregate score for a unit (HMAC, by `ref` or `id`) |
| `/api/judgments` | accepts a judgment, returns attestation token |
| `/api/verify` | server-side token verification (operator-key auth) |
| `/v1.js` | drop-in widget loader (pill mode default, modal expands on click) |

unit types implemented in the public pool: pairwise_taste, taste_rank, dub_sync, sincere_vs_sarcastic, ai_vs_real, headline_pick, drag_to_rank, span_highlight, **ai_output_rating** (operator-ingested image rating with peer-aggregate scoring, no gold). honeypot variants of taste pool units.

## operator integration — closing the feedback loop

panel isn't just a captcha. for operators running real AI workflows (image gen, copy gen, code agents), every output their pipeline produces can become a rateable unit. captcha-solvers rate the operator's prior outputs → the operator gets continuous quality telemetry on the same loop that verifies humanness.

### the wedge

| feature | turnstile / hcaptcha | panel |
|---|---|---|
| proof of humanity | ✓ | ✓ |
| feedback signal on operator's actual outputs | ✗ | ✓ |
| quality score per artifact, queryable by ref | ✗ | ✓ |
| dataset operator keeps | ✗ | ✓ |

### embed (the new compact pill UI)

```html
<script src="https://panel.goku.codes/v1.js" defer></script>
<div data-panel-sitekey="pk_yoursite_xxxx" data-panel-pool="public"></div>
```

renders as a ~240px-wide pill (`verify you're human`). click → modal overlay with the unit. solve → token → pill turns green (`verified`) → modal auto-closes. token fires on `panel:solved` custom event and via `onSolved(token, info)` callback when programmatically rendered.

modes:
- `data-panel-mode="pill"` (default) — Cloudflare-Turnstile-shape compact widget
- `data-panel-mode="inline"` — full inline iframe (legacy)

### feed your outputs back into the queue (HMAC-signed)

```http
POST https://panel.goku.codes/api/units/ingest
X-Panel-Site-Key: pk_yoursite_xxxx
X-Panel-Ingest-Sig: <hmac-sha256-hex of raw body, using PANEL_INGEST_SECRET_<UPPER_SITEKEY>>
Content-Type: application/json

{
  "units": [{
    "external_ref": "your-stable-artifact-id",
    "image_url": "https://your.cdn/output.png",
    "op_label": "remove_bg",
    "prompt_context": "input=src.png"
  }]
}
```

returns `{ ok, accepted, ids: ["u_ing_..."] }`. unit becomes a `ai_output_rating` job rendered as a 4-pill grid (good / meh / broken / spam).

### read aggregate score

```
GET /api/units/score?ref=<external_ref>&site=<site_key>
X-Panel-Site-Key: pk_yoursite_xxxx
X-Panel-Ingest-Sig: <hmac of canonical string: "GET\n/api/units/score\nref=<r>\nid=\nsite=<k>">
```

returns `{ ok, unit_id, external_ref, n, counts: {good,meh,broken,spam}, score, quality, last_judged_at }`.

### per-site secret naming convention

operator secret env vars on panel: `PANEL_INGEST_SECRET_<UPPERCASE_SITEKEY_DASHES_TO_UNDERSCORES>`. e.g. site_key `pk_img_3e9b8c028d0e` → `PANEL_INGEST_SECRET_PK_IMG_3E9B8C028D0E`. fallback: global `PANEL_INGEST_SECRET`.

### live integration

`img.goku.codes` runs panel in production as the captcha gate on uploads. every Modal AI op output (upscale, remove_bg, etc.) is auto-ingested and rateable. quality readback at `https://img.goku.codes/api/quality/<output_key>`.

## status

proof of concept. it runs. it persists. it collects behavioral signals. it has the pool split.

it does not have: SOC 2, BAA, a paying customer, a real bot-flag rate measured on adversarial traffic, the scrubber-proxy GA, the trust-tier paid pipeline, the panel-data API. all on the roadmap, none shipped.

## run locally

```
pnpm install
pnpm dev
# http://127.0.0.1:3015
```

env:

```
PANEL_DB_PATH=./panel.db
PANEL_OPERATOR_SIGNING_KEY=<32+ random bytes>
```

## deploy

production: panel.goku.codes. systemd-user unit + nginx reverse proxy.

## who this is for

everybody who'd otherwise drop in recaptcha or turnstile. the wedge is a change in thinking, not a vertical.

- today the unit is "judge a piece of agent output" (taste, sarcasm, dub-sync, AI-vs-real). tomorrow the unit can be any signal a site already wants from a human — survey, sentiment, recall, recognition, preference.
- the captcha is the distribution channel. the judgment is the product. every site that drops in panel gets bot-blocking and a continuous human-feedback stream on whatever it routes through.
- so the addressable surface is the whole recaptcha/turnstile/hCaptcha footprint — signup forms, comments, checkout, paywalls, downloads, login, password reset — across consumer, b2b, enterprise, gov, dev tools, hospital portals, ticketing, e-com, AI products, anywhere a human-vs-bot gate sits today.

early lighthouse design partners (where the dogfood loop is sharpest) live in `(600) Work/panel/gtm/Segments.md`. the platform itself has no vertical lock-in.

## license

MIT — see [LICENSE](LICENSE).

## security

found a bug? see [SECURITY.md](SECURITY.md). short version: email security@goku.codes, don't open a public issue.

operator runbook: [docs/ops.md](docs/ops.md).
