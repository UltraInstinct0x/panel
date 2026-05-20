# panel-sdk

first-class typescript sdk for emitting media + agent units to [panel](https://panel.goku.codes).

handles hmac-sha256 signing, batching, and the ingest contract so external operators can push one unit in three lines.

## install

```sh
npm install panel-sdk
# or
pnpm add panel-sdk
```

requires node 18+ or any edge runtime with `globalThis.fetch` and `globalThis.crypto.subtle`.

## quickstart

```ts
import { createClient } from 'panel-sdk';

const panel = createClient({ siteKey: process.env.PANEL_KEY!, secret: process.env.PANEL_SECRET! });
await panel.emitMedia({ url: 'https://example.com/cat.png', type: 'image', mediaType: 'image/png', groundTruth: 'real' });
```

## node example

```ts
import { createClient } from 'panel-sdk';

const panel = createClient({
  siteKey: process.env.PANEL_KEY!,
  secret: process.env.PANEL_SECRET!,
  // base: 'http://localhost:3015',  // override for local dev
});

const r = await panel.emitMedia({
  url: 'https://cdn.example.com/gen-1234.png',
  type: 'image',
  mediaType: 'image/png',
  prompt: 'a cat in a hat',
  groundTruth: 'ai',
  extra: { model: 'flux-dev', sha256: '…' },
});
if (!r.ok) throw new Error(r.error);
console.log('accepted', r.id);
```

## edge runtime example (vercel / cloudflare)

```ts
// app/api/relay/route.ts
import { createClient } from 'panel-sdk';

export const runtime = 'edge';

export async function POST(req: Request) {
  const { url } = await req.json();
  const panel = createClient({ siteKey: process.env.PANEL_KEY!, secret: process.env.PANEL_SECRET! });
  const r = await panel.emitMedia({ url, type: 'image', mediaType: 'image/png' });
  return Response.json(r);
}
```

on edge, `sign()` falls back to `globalThis.crypto.subtle` automatically — no node:crypto needed.

## methods

- `client.emitMedia({ url, type, mediaType, prompt?, groundTruth?, extra? })` — emits `media_origin` (when `groundTruth` is `'real'` or `'ai'`) or `media_quality`.
- `client.emitProcessOutput({ kind, content, context? })` — maps to `process_output_rating`.
- `client.emitSkillDiff({ skill, before, after })` — maps to `skill_diff_review`.
- `client.emitRaw(units)` — escape hatch: post one or more raw unit dicts.

all methods return `{ ok, id?, ids?, error?, status }`.

## threat model: secret placement

the ingest secret is a long-lived shared secret. **never bundle it into a browser app.** anyone with the secret can mint accepted units under your site key. the sdk refuses to run in a dom context unless you pass `allowBrowser: true`, which is reserved for proxy patterns where the sdk lives in a same-origin worker that fronts a server-side trust boundary.

recommended placements:

- node service / cron / worker
- next.js route handler / server action
- vercel / cloudflare edge function
- modal / lambda function

bad placements:

- browser bundle
- mobile app shipped to users
- any client where secrets can be extracted from the binary

## v6a scope

ships: node + edge support, three high-level emit methods, hmac signing, mocked tests. deferred to v6b/v6c: browser-proxy mode, retry/backoff, batched flushers, attestation header support, react hooks.
