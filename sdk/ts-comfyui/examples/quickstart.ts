// panel-comfyui-adapter quickstart. assumes a local comfyui on 8188.
import { createClient } from 'panel-sdk';
import { createComfyAdapter } from '../src/index.js';

const panel = createClient({
  siteKey: process.env.PANEL_SITE_KEY!,
  secret: process.env.PANEL_SECRET!,
  base: process.env.PANEL_BASE,
});

const comfy = createComfyAdapter({
  comfyUrl: process.env.COMFY_URL ?? 'http://127.0.0.1:8188',
  panelClient: panel,
});

const r = await comfy.submit({
  workflow: process.env.WORKFLOW_PATH ?? './workflow_api.json',
  prompt: 'a pirate galleon at sunset, oil on canvas',
  groundTruth: 'ai',
});

console.log(JSON.stringify(r, null, 2));
