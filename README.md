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
| public captcha | taste, sarcasm, dub-sync, voice naturalness, cultural recency, perception, sincere-vs-sarcastic, AI-vs-real, media quality, media origin | human (or ambiguous) | `/demo/gate`, drive-by raters, anonymous |
| paid rater | tool_call_validity, reasoning_trace_quality, code_diff_review, response_factuality, safety_alignment, skill_diff_review, step_validity, multi_turn_coherence, commit_description_quality, pairwise traces, hallucination calls | flagship wins easy | dogfood loop, T2+ trust raters, internal harness |

**key rule: public pool units must be grandma-safe.** no code diffs, no tool calls, no reasoning traces. technical judgment units live exclusively in the paid rater pool.

## the verification model — the environment IS the captcha

panel doesn't give visitors explicit "challenges" to solve. that's the wrong frame. you can't queue human-testing challenges alongside bot-testing challenges on the same person — a math test that's hard for humans would block real users, and flagship LLMs increasingly handle sarcasm and taste.

instead: **the page environment itself is the test.** humans and agents experience the same page completely differently. the verification layer observes *how* the visitor interacts with the environment, not *what* they answer.

### the four layers

| # | layer | mode | what it detects |
|---|---|---|---|
| 1 | **behavioral telemetry** | passive, continuous | mouse entropy, scroll variance, focus events, dwell time, paste detection, click precision, timing distributions. humans have natural variance and micro-tremor; bots and agents have uniform timing and linear trajectories. |
| 2 | **environment fingerprint** | passive, one-shot | WebDriver flags, headless browser indicators, automation framework globals (Selenium, Puppeteer, Playwright, CDP artifacts), canvas/WebGL fingerprints. catches known bot infrastructure. |
| 3 | **environment traps** | active, invisible | page contains things only agents would notice or interact with. see below. |
| 4 | **public pool judgment** | active, escalated | taste, perception, AI-vs-real, media quality units — only served when layers 1-3 are ambiguous. grandma-safe: trivially easy for a human, subtly hard for current AI. |

### environment traps (layer 3)

the page embeds signals that humans ignore but agents can't resist processing:

- **metadata traps** — embed incorrect metadata in the DOM (wrong `data-*` attributes, fake structured data, misleading meta tags). agents that parse and act on it reveal themselves. humans never read metadata.
- **hidden DOM elements** — elements visible to DOM parsers but not rendered (display:none, off-screen, zero-opacity). agents that "click" or reference them are flagged. humans can't interact with what they can't see.
- **ambiguity resistance** — page presents something slightly odd or ambiguous. humans shrug and continue naturally. LLMs over-analyze, ask for clarification, or freeze. measure time-to-next-action after ambiguity.
- **obviousness tests** — a button says "click here to verify." humans click it. an LLM might inspect it, read its attributes, or try to find a trick. measure the ratio of direct-action vs. inspection-action.
- **interaction entropy** — humans have natural randomness (variable click positions, imperfect trajectories, hesitation). agents have patterns (precise coordinates, sequential steps, tool-call-shaped delays). measure entropy across the full interaction trace.
- **delay signatures** — agents have characteristic timing: API call latency followed by sequential tool execution. humans have variable delays (reading, thinking, distraction, tab-switch). model the delay distribution.
- **multi-turn pattern detection** — agents that interact across multiple pages/forms follow sequential tool-use patterns (fill field → submit → wait → fill next). humans have organic, non-linear navigation (back, skip, revisit).

### verdict matrix

| behavioral | environment | traps | judgment | token | verdict to operator |
|---|---|---|---|---|---|
| natural | clean | no trap triggered | n/a | **high-trust** | human — accept |
| automated | dirty | trap triggered | n/a | **none / blocked** | bot — reject |
| natural | clean | trap triggered | pass | **low-trust** | AI agent (sophisticated) — operator decides |
| any | any | no trap | fail | **none / blocked** | bot (LLM solver) — reject |
| natural | clean | ambiguous | ambiguous | **low-trust** | uncertain — operator decides |

the token is not unconditional — it carries the verdict and trust level. the operator decides their risk tolerance via `/api/verify`: accept only high-trust tokens, accept standard+, or accept all and handle risk downstream. most real humans get high-trust tokens instantly (layers 1-3 clean). bots get blocked or flagged tokens they can't use.

### escalation policy

1. layers 1+2 run on every request — zero friction
2. layer 3 (traps) is always present in the page — invisible to humans
3. if layers 1-3 all say "clean human" → issue **high-trust token** immediately. no challenge shown.
4. if any layer is ambiguous → escalate to layer 4 (public pool judgment unit)
5. if layer 4 passed → issue **standard-trust token**
6. if layer 4 failed or layers 1-3 were flagged → issue **low-trust token** (or block, per operator config)
7. honeypot units (D13.4) are silently seeded in layer 4 — flunking = low-trust or blocked

## the other defenses (D13)

even taste degrades if a bot brute-forces. layers:

1. behavioral floor — mouse / scroll / focus / dwell entropy. bot must fake distributions, not just answer.
2. engagement window — 2.5–4s minimum, variance check.
3. interaction-required hard tiers — drag-to-rank, highlight-the-span, drag-onto-moving-target.
4. honeypot units — quietly seeded units where the obvious-LLM-answer is wrong by design. flunking = flagged.
5. opaque scoring — token carries a trust level; the gold-agreement score refines it hours later. operator can reject low-trust tokens immediately or accept and refine asynchronously.

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

unit types implemented in the public pool: pairwise_taste, taste_rank, dub_sync, sincere_vs_sarcastic, ai_vs_real, headline_pick, drag_to_rank, span_highlight, **ai_output_rating** (operator-ingested image rating with peer-aggregate scoring, no gold), **skill_diff_review** (hermes skill update judgment, weighted consensus API), **media_quality** (AI-generated image/video rating), **media_origin** (AI-vs-real binary with honeypot seeding). honeypot variants of taste pool units.

unit types designed (V5 — implementation queued): `tool_call_validity`, `reasoning_trace_quality`, `code_diff_review`, `response_factuality`, `gui_action_sequence`, `safety_alignment`, `multi_turn_coherence`, `commit_description_quality`. these generalize panel beyond hermes-native surfaces to any agent that emits tool calls, reasoning traces, code patches, or GUI actions — including claude code, codex, opencode, cursor, windsurf, and any MCP/ACP-compatible harness.

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

working prototype. it runs, persists, collects behavioral signals, has the pool split, weighted consensus on skill reviews, media rating with honeypot seeding, and a live integration on img.goku.codes.

shipped: captcha widget (pill + inline modes), rater dashboard, operator dashboard, skill-review API (ingest + weighted verdict), media quality/origin types, HMAC-signed ingest, per-site secrets, legal pages, pricing page, rater-as-reviewer loop.

in progress: scrubber-proxy GA, trust-tier paid pipeline, panel-data API, V5 broader agent scope unit types, SOC 2 posture.

## for agent developers

if you're building an agent harness (claude code plugin, codex integration, opencode agent, MCP server, browser-use wrapper), panel can be your preference-data layer:

1. **drop in the captcha** — one script tag, your visitors get bot-blocking
2. **emit agent outputs** — POST tool calls, code diffs, reasoning traces, media outputs via the HMAC-signed ingest API
3. **get preference data** — humans judge your agent's outputs as part of proving they're human. you keep the dataset.

what you can ingest today: `ai_output_rating` (image/text), `media_quality`, `media_origin`, `skill_diff_review`.

coming (V5): `tool_call_validity`, `code_diff_review`, `reasoning_trace_quality`, `gui_action_sequence`, `safety_alignment`, `multi_turn_coherence`, `commit_description_quality`, `response_factuality`. **note: all V5 technical types are paid-rater-pool-only.** your agent's outputs become units for trusted raters, not for your site's anonymous captcha visitors. your visitors solve taste/perception/human-hard units; your agent outputs get judged by the trust-tier rater pool.

the idea: every agent run produces rateable artifacts. panel turns your captcha surface into a continuous quality signal on your agent's actual work — not a synthetic benchmark, not a survey, not a focus group. real users, real outputs, real judgments.

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

everybody who'd otherwise drop in recaptcha or turnstile — and every agent developer who wants continuous human feedback on their outputs without building a labeling pipeline.

- today the unit is "judge a piece of agent output" (taste, sarcasm, dub-sync, AI-vs-real, code diffs, tool calls, reasoning traces, GUI actions, media quality). tomorrow the unit can be any signal a site already wants from a human — survey, sentiment, recall, recognition, preference.
- the captcha is the distribution channel. the judgment is the product. every site that drops in panel gets bot-blocking and a continuous human-feedback stream on whatever it routes through.
- so the addressable surface is the whole recaptcha/turnstile/hCaptcha footprint — signup forms, comments, checkout, paywalls, downloads, login, password reset — across consumer, b2b, enterprise, gov, dev tools, hospital portals, ticketing, e-com, AI products, anywhere a human-vs-bot gate sits today.
- and the agent-developer surface is the whole claude code / codex / opencode / cursor / windsurf / MCP ecosystem — anywhere an agent produces outputs a human could judge.

the platform itself has no vertical lock-in and no agent-harness lock-in. V5 unit types are designed to work with any harness that emits structured outputs.

## license

MIT — see [LICENSE](LICENSE).

## security

found a bug? see [SECURITY.md](SECURITY.md). short version: email security@goku.codes, don't open a public issue.

operator runbook: [docs/ops.md](docs/ops.md).
