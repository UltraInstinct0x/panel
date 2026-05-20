// GET /api/units/score?ref=<external_ref>  OR  ?id=<unit_id>
// returns aggregate score for an operator-ingested unit.
// auth: same site_key HMAC as ingest (read-only score). Operators only read their own units.
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// shared link table — also created by /api/units/ingest. Idempotent.
db.exec(`
  CREATE TABLE IF NOT EXISTS ingested_unit_links (
    unit_id TEXT PRIMARY KEY,
    site_key TEXT NOT NULL,
    external_ref TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_iul_ext ON ingested_unit_links(site_key, external_ref);
`);

function ingestSecretFor(siteKey: string): string | null {
  const envKey = `PANEL_INGEST_SECRET_${siteKey.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  return process.env[envKey] || process.env.PANEL_INGEST_SECRET || null;
}
function timingEqual(a: string, b: string): boolean {
  const A = Buffer.from(a, 'hex'); const B = Buffer.from(b, 'hex');
  if (A.length === 0 || A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

export async function GET(req: NextRequest) {
  const siteKey = req.headers.get('x-panel-site-key') || '';
  const sig = req.headers.get('x-panel-ingest-sig') || '';
  const url = new URL(req.url);
  const ref = url.searchParams.get('ref') || '';
  const idParam = url.searchParams.get('id') || '';

  if (!siteKey) return NextResponse.json({ error: 'missing_site_key' }, { status: 401 });
  const secret = ingestSecretFor(siteKey);
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 401 });

  // sign over canonical query string
  const canonical = `GET\n/api/units/score\nref=${ref}\nid=${idParam}\nsite=${siteKey}`;
  const expected = crypto.createHmac('sha256', secret).update(canonical).digest('hex');
  if (!sig || !timingEqual(expected, sig)) {
    return NextResponse.json({ error: 'bad_signature', canonical_hint: 'GET\\n/api/units/score\\nref=<ref>\\nid=<id>\\nsite=<site_key>' }, { status: 401 });
  }

  // (link table created at module init)

  let unitId = idParam;
  if (!unitId && ref) {
    const row = db.prepare('SELECT unit_id FROM ingested_unit_links WHERE site_key=? AND external_ref=?').get(siteKey, ref) as any;
    unitId = row?.unit_id || '';
  }
  if (!unitId) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  // verify ownership
  const own = db.prepare('SELECT 1 FROM ingested_unit_links WHERE unit_id=? AND site_key=?').get(unitId, siteKey);
  if (!own) return NextResponse.json({ ok: false, error: 'not_yours' }, { status: 403 });

  const judgments = db.prepare(
    `SELECT j.choice, j.created_at, j.honeypot_failed, r.trust
       FROM judgments j LEFT JOIN raters r ON r.id = j.rater_id
      WHERE j.unit_id = ?`
  ).all(unitId) as { choice: string; created_at: number; honeypot_failed: number; trust: number | null }[];

  const counts = { good: 0, meh: 0, broken: 0, spam: 0 };
  let trustSum = 0; let trustWeighted = 0;
  for (const j of judgments) {
    if (j.honeypot_failed) continue;
    if (j.choice in counts) (counts as any)[j.choice] += 1;
    const w = Math.max(0, Math.min(1, j.trust ?? 0.5));
    trustSum += w;
    // good=1.0, meh=0.5, broken=-0.5, spam=-1.0
    const v = j.choice === 'good' ? 1 : j.choice === 'meh' ? 0.5 : j.choice === 'broken' ? -0.5 : j.choice === 'spam' ? -1 : 0;
    trustWeighted += v * w;
  }
  const n = judgments.length;
  const score = trustSum > 0 ? trustWeighted / trustSum : null;  // -1..+1
  // normalize to 0..1 quality
  const quality = score === null ? null : Math.max(0, Math.min(1, (score + 1) / 2));

  audit('operator', siteKey, 'score.read', 'judgments', unitId, { n, ref });

  return NextResponse.json({
    ok: true,
    unit_id: unitId,
    external_ref: ref || null,
    n,
    counts,
    score,
    quality,
    last_judged_at: judgments.length ? Math.max(...judgments.map(j => j.created_at)) : null,
  });
}
