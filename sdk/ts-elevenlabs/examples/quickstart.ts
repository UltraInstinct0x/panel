// minimal example: synthesize text to speech and emit to panel.
// run: PANEL_KEY=... PANEL_SECRET=... ELEVENLABS_API_KEY=... tsx examples/quickstart.ts
import { createClient } from 'panel-sdk';
import { createElevenLabsAdapter } from 'panel-elevenlabs-adapter';

const panel = createClient({ siteKey: process.env.PANEL_KEY!, secret: process.env.PANEL_SECRET! });
const tts = createElevenLabsAdapter({ apiKey: process.env.ELEVENLABS_API_KEY!, panelClient: panel });

const r = await tts.synthesize({
  text: 'the quick brown fox jumps over the lazy dog',
  voiceId: 'EXAVITQu4vr4xnSDxMaL',
  groundTruth: 'ai',
});
console.log(`emitted ${r.bytes} audio bytes (sha256=${r.sha256.slice(0, 12)}…)`);
