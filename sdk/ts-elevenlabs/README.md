# panel-elevenlabs-adapter

Reference adapter for [ElevenLabs](https://elevenlabs.io) TTS → Panel. ~100 lines of glue:
synthesize text, sha256 the returned audio bytes, emit via `panel-sdk`.

This is a **reference** adapter — meant as a copyable `wrap-and-emit` pattern, not a
deep first-party integration.

## Quickstart (3 lines)

```ts
import { createClient } from 'panel-sdk';
import { createElevenLabsAdapter } from 'panel-elevenlabs-adapter';

const panel = createClient({ siteKey: process.env.PANEL_KEY!, secret: process.env.PANEL_SECRET! });
const tts = createElevenLabsAdapter({ apiKey: process.env.ELEVENLABS_API_KEY!, panelClient: panel });
await tts.synthesize({ text: 'hello world', voiceId: 'EXAVITQu4vr4xnSDxMaL', groundTruth: 'ai' });
```

## API

```ts
createElevenLabsAdapter({ apiKey, panelClient, fetch?, base?, defaultModelId?, uploader? })
  .synthesize({ text, voiceId, modelId?, prompt?, groundTruth?, extra?, externalRef? })
    => Promise<{ sha256, mediaType, url, bytes, result }>
```

`modelId` defaults to `eleven_multilingual_v2`. `voiceId` is path-encoded so values with
slashes or spaces are safe. The TTS endpoint returns `audio/mpeg` binary; bytes are
sha256-hashed and base64-encoded into a `data:` URL by default. Pass `uploader` to push
to your own CDN/object store first and emit a hosted URL instead.

## Audio caveat

Panel's ingest route currently accepts `media_type` ∈ `image|video` for the
`media_origin` / `media_quality` unit types — `audio` is forwarded by `panel-sdk` but
will be rejected server-side. Dedicated `audio_quality` / `audio_origin` unit types are
deferred (see panel TODO). This adapter still emits with `type: 'audio'` so it works
forward-compatibly the moment that ships. Until then, expect a 4xx on emit; treat this
adapter as a forward-compat shim or wrap in a try/catch as you adopt.

## Threat model

- **Server-side only.** `apiKey` and panel `secret` must never reach a browser.
- The default `data:` URL embeds full audio bytes in the unit body. Long clips can blow
  past your ingest body limit — prefer `uploader` for anything over a few seconds.
- This adapter does no rate-limiting; throttle at the call site.

## Build / test

```sh
npm install
npm run build
npm test     # node:test, fully mocked fetch — no live API calls
```
