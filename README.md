# panel

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
| `/api/units/next` | returns one unit from the public taste pool |
| `/api/judgments` | accepts a judgment, returns attestation token |
| `/api/verify` | server-side token verification (operator-key auth) |

unit types implemented in the public pool: pairwise_taste, taste_rank, dub_sync, sincere_vs_sarcastic, ai_vs_real, headline_pick. honeypot variants of each.

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

ranked verticals in `(600) Work/panel/gtm/Segments.md` (private vault). public version:

- indie ticketing (Posh, Tixr, DICE, ZipperTic) — anti-scalping where verified-fan is already farmed.
- paid newsletter writers on substack / beehiiv / ghost — bot-subs killing deliverability.
- DTC shopify non-plus — card-testing bots polluting pixel data.
- seed-stage telemed — SMS/voice OTP toll-fraud (H-ISAC Jan 2026).
- direct-stripe creators — chargeback evidence at purchase confirm.

not for: ticketmaster, salesforce commerce, hospital systems, dev tools, AI startup signup forms.

## license

MIT
