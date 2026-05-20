// minimal example: wrap a replicate prediction and emit produced media to panel.
// run: PANEL_KEY=... PANEL_SECRET=... REPLICATE_TOKEN=... tsx examples/quickstart.ts
import { createClient } from 'panel-sdk';
import { createReplicateAdapter } from 'panel-replicate-adapter';

const panel = createClient({ siteKey: process.env.PANEL_KEY!, secret: process.env.PANEL_SECRET! });
const replicate = createReplicateAdapter({ replicateToken: process.env.REPLICATE_TOKEN!, panelClient: panel });

const r = await replicate.runImage({
  model: 'stability-ai/sdxl',
  input: { prompt: 'a tiny cat astronaut, studio lighting' },
  prompt: 'a tiny cat astronaut, studio lighting',
  groundTruth: 'ai',
});
console.log(`emitted ${r.emits.length} unit(s) for prediction ${r.prediction.id}`);
