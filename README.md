# panel

> captcha-shaped feedback layer for agent outputs. visitors prove they're human by judging one tiny piece of agent work. operators get a captcha. agent stacks get continuous preference data.

**status:** proof of concept. design docs in private vault — see [Project Hub] (private).

## what's in this repo

a minimal Next.js demo that shows the four user-facing surfaces:

| route | what it is |
|---|---|
| `/` | landing — pitch + live link to each demo surface |
| `/demo/gate` | captcha-style gate (a fake operator's signup form embedding the panel widget) |
| `/widget` | the panel widget itself (iframe-embeddable, served as a standalone page) |
| `/dashboard` | rater-facing log of recent judgments + trust score |
| `/operator` | operator dashboard mockup — embed code + traffic + dataset preview |
| `/api/units/next` | returns a fresh mock unit (pairwise trace, step validity, skill diff vote, hallucination flag, taste rank) |
| `/api/judgments` | accepts a judgment, returns updated trust delta |

no database. in-memory store. seed data baked in. enough to feel the loop, nothing more.

## run locally

```
pnpm install
pnpm dev
# open http://127.0.0.1:3015
```

## deploy

production target: `panel.goku.codes`. systemd-user unit + nginx reverse proxy, same shape as other goku.codes apps.

## license

MIT
