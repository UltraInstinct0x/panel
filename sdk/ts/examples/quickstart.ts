// minimal example: emit one media unit in 3 lines.
// run: PANEL_KEY=... PANEL_SECRET=... tsx examples/quickstart.ts
import { createClient } from 'panel-sdk';

const panel = createClient({ siteKey: process.env.PANEL_KEY!, secret: process.env.PANEL_SECRET! });
const r = await panel.emitMedia({ url: 'https://example.com/cat.png', type: 'image', mediaType: 'image/png', groundTruth: 'real' });
console.log(r);
