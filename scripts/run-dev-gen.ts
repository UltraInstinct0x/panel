// V5 driver — calls the Modal dev-gen endpoint, hashes outputs, emits as
// media_origin (truth=ai) + media_quality units to panel via the
// modal-dev-gen ingest key (HMAC-SHA256, X-Panel-Site-Key + X-Panel-Ingest-Sig).
//
// usage:
//   MODAL_DEV_GEN_URL=https://ultrainstinct0x--panel-dev-gen.modal.run \
//   MODAL_DEV_GEN_TOKEN=$(cat ~/.secrets/panel-modal-dev-gen-token.txt) \
//   PANEL_INGEST_KEY=$(cat ~/.secrets/panel-emit-modal-dev-gen.key) \
//   PANEL_INGEST_SECRET=$(cat ~/.secrets/panel-emit-modal-dev-gen.txt) \
//   PANEL_BASE=http://localhost:3015 \
//   tsx scripts/run-dev-gen.ts "a cat in a hat" 2

import { createHash, createHmac } from 'crypto';

const MODAL_URL    = process.env.MODAL_DEV_GEN_URL?.replace(/\/$/, '');
const MODAL_TOKEN  = process.env.MODAL_DEV_GEN_TOKEN || '';
const PANEL_BASE   = (process.env.PANEL_BASE || 'http://localhost:3015').replace(/\/$/, '');
const INGEST_KEY   = process.env.PANEL_INGEST_KEY || '';
const INGEST_SEC   = process.env.PANEL_INGEST_SECRET || '';

if (!MODAL_URL || !INGEST_KEY || !INGEST_SEC) {
  console.error('missing env: MODAL_DEV_GEN_URL, PANEL_INGEST_KEY, PANEL_INGEST_SECRET');
  process.exit(2);
}

interface ModalItem { image_id: string; url: string; prompt: string; model: string; created_at: number; }

async function modalGenerate(prompt: string, n: number, seed: number | null): Promise<ModalItem[]> {
  const r = await fetch(`${MODAL_URL!}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(MODAL_TOKEN ? { 'Authorization': `Bearer ${MODAL_TOKEN}` } : {}),
    },
    body: JSON.stringify({ prompt, n, seed }),
  });
  if (!r.ok) throw new Error(`modal ${r.status}: ${await r.text()}`);
  const j: any = await r.json();
  return j.items || [];
}

async function sha256OfUrl(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return createHash('sha256').update(buf).digest('hex');
}

async function emitBatch(units: any[]): Promise<any> {
  // body = JSON array of unit dicts (matches panel_emitter.py contract)
  const body = JSON.stringify(units);
  const sig = createHmac('sha256', INGEST_SEC).update(body).digest('hex');
  const r = await fetch(`${PANEL_BASE}/api/units/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Panel-Site-Key': INGEST_KEY,
      'X-Panel-Ingest-Sig': sig,
    },
    body,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`ingest ${r.status}: ${text}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function main() {
  const prompt = process.argv[2];
  const n = parseInt(process.argv[3] || '1', 10);
  if (!prompt) { console.error('usage: tsx run-dev-gen.ts "<prompt>" [n]'); process.exit(2); }

  console.log(`[dev-gen] prompt=${JSON.stringify(prompt)} n=${n}`);
  const items = await modalGenerate(prompt, n, null);
  console.log(`[dev-gen] modal returned ${items.length} items`);

  const units: any[] = [];
  for (const it of items) {
    const sha = await sha256OfUrl(it.url);
    console.log(`  ${it.image_id} sha=${sha.slice(0, 12)}…`);

    // media_origin — ground-truth label "ai" lets us measure rater accuracy
    units.push({
      type: 'media_origin',
      external_ref: `dev-gen:${it.image_id}:origin`,
      source_agent: 'modal-dev-gen',
      media_url: it.url,
      media_type: 'image',
      prompt_context: it.prompt,
      ground_truth: 'ai',
      meta: { sha256: sha, model: it.model, generated_at: it.created_at },
    });
    // media_quality — no ground truth (subjective)
    units.push({
      type: 'media_quality',
      external_ref: `dev-gen:${it.image_id}:quality`,
      source_agent: 'modal-dev-gen',
      media_url: it.url,
      media_type: 'image',
      prompt_context: it.prompt,
      meta: { sha256: sha, model: it.model, generated_at: it.created_at },
    });
  }

  if (units.length === 0) { console.log('no units'); return; }
  const res = await emitBatch(units);
  console.log('panel ->', JSON.stringify(res));
}

main().catch((e) => { console.error(e); process.exit(1); });
