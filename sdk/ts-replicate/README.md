# panel-replicate-adapter

Reference adapter for [Replicate](https://replicate.com) → Panel. ~150 lines of glue:
create a prediction, poll until done, sha256 + emit each output URL via `panel-sdk`.

This is a **reference** adapter — meant as a copyable `wrap-and-emit` pattern, not a
deep first-party integration. First-party adapters (e.g. ComfyUI) live elsewhere.

## Quickstart (3 lines)

```ts
import { createClient } from 'panel-sdk';
import { createReplicateAdapter } from 'panel-replicate-adapter';

const panel = createClient({ siteKey: process.env.PANEL_KEY!, secret: process.env.PANEL_SECRET! });
const replicate = createReplicateAdapter({ replicateToken: process.env.REPLICATE_TOKEN!, panelClient: panel });
await replicate.runImage({ model: 'stability-ai/sdxl', input: { prompt: 'a cat' }, prompt: 'a cat', groundTruth: 'ai' });
```

## API

```ts
createReplicateAdapter({ replicateToken, panelClient, fetch?, base?, pollIntervalMs?, pollTimeoutMs? })
  .runImage({ model, input, prompt?, groundTruth?, extra?, externalRef? }) => Promise<RunResult>
  .runVideo({ ... }) => Promise<RunResult>
```

`model` accepts an `owner/name` slug or a 64-char-hex version id. Outputs are normalized
into a string array, each URL is downloaded, sha256-hashed, and emitted via
`panel.emitMedia`. mediaType is taken from `Content-Type` and falls back to URL
extension (`.png`, `.mp4`, `.webm`, …).

## Threat model

- **Server-side only.** `replicateToken` and panel `secret` must never reach a browser.
  Use this adapter from your backend / worker, behind your own auth.
- This adapter does not validate output URLs against an allowlist. If the model can
  produce an arbitrary URL, treat the URL as untrusted before emitting.
- The adapter downloads each output URL once (to hash it). Be aware of egress and
  bandwidth costs for large video outputs.

## Build / test

```sh
npm install
npm run build
npm test     # node:test, fully mocked fetch — no live API calls
```
