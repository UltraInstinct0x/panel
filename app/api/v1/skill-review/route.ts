// POST /api/v1/skill-review — convenience wrapper. Agents submit one skill diff,
// server ingests it as a skill_diff_review unit and returns the verdict URL + poll URL.
// Auth: same HMAC as /api/units/ingest (site_key + sig over body).
// This is purely sugar over /api/units/ingest — easier to integrate than batch-shaped ingest.
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { checkBoth, clientIp, rateLimitHeaders } from '@/lib/ratelimit';
import { logAccess } from '@/lib/logger';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

export async function POST(req: NextRequest) {
  const started = Date.now();
  const ip = clientIp(req);
  const siteKey = req.headers.get('x-panel-site-key') || '';
  const sig = req.headers.get('x-panel-ingest-sig') || '';
  const raw = await req.text();

  const rl = checkBoth(ip, siteKey);
  if (!rl.ok) {
    const res = NextResponse.json({ error: 'rate_limited', scope: rl.scope, retry_after_s: rl.retry_after_s }, { status: 429 });
    for (const [k, v] of Object.entries(rateLimitHeaders(rl))) res.headers.set(k, v);
    logAccess({ ts: started, method: 'POST', path: '/api/v1/skill-review', status: 429, ms: Date.now() - started, site_key: siteKey, ip, rl });
    return res;
  }

  if (!siteKey || !sig) return NextResponse.json({ error: 'missing_auth' }, { status: 401 });
  const secret = ingestSecretFor(siteKey);
  if (!secret) return NextResponse.json({ error: 'ingest_not_configured' }, { status: 401 });
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  if (!timingEqual(expected, sig)) {
    audit('operator', siteKey, 'skill_review.bad_sig', 'units', '', null);
    return NextResponse.json({ error: 'bad_signature' }, { status: 401 });
  }

  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  const externalRef = String(body?.external_ref || body?.pr || body?.commit || '').slice(0, 200);
  const skillName = String(body?.skill_name || body?.skill || '').slice(0, 200);
  const diff = String(body?.diff || '').slice(0, 8000);
  const promptContext = String(body?.context || body?.prompt_context || (skillName ? `proposed edit to ${skillName}` : '')).slice(0, 2000);
  const sourceAgent = String(body?.source_agent || body?.agent || '').slice(0, 200);
  const yesLabel = String(body?.yes_label || 'ship it').slice(0, 32);
  const noLabel = String(body?.no_label || 'reject').slice(0, 32);
  const trustedPoolOnly = Boolean(body?.trusted_pool_only);
  const unitPool = trustedPoolOnly ? 'technical' : 'public';

  if (!diff) return NextResponse.json({ error: 'diff_required' }, { status: 400 });

  const seed = `${siteKey}|${externalRef}|skill_diff_review|${diff.slice(0, 200)}`;
  const h = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 16);
  const unitId = `u_ing_${h}`;
  const now = Math.floor(Date.now() / 1000);

  const existing = db.prepare('SELECT id FROM units WHERE id=?').get(unitId);
  let created = false;
  if (!existing) {
    const unit: any = {
      id: unitId,
      type: 'skill_diff_review',
      pool: unitPool,
      source_agent: sourceAgent || null,
      prompt_context: promptContext || null,
      question: 'should this skill update ship?',
      diff,
      binary: { yes: yesLabel, no: noLabel },
      is_honeypot: false,
      est_seconds: 8,
    };
    db.prepare('INSERT INTO units(id, json, pool, is_honeypot, created_at) VALUES (?,?,?,?,?)').run(
      unitId, JSON.stringify(unit), unitPool, 0, now,
    );
    if (externalRef) {
      db.prepare(
        `INSERT INTO ingested_unit_links(unit_id, site_key, external_ref, created_at) VALUES (?,?,?,?)
         ON CONFLICT(unit_id) DO NOTHING`
      ).run(unitId, siteKey, externalRef, now);
    }
    created = true;
  }

  audit('operator', siteKey, created ? 'skill_review.created' : 'skill_review.dedup', 'units', unitId, { ref: externalRef, skill: skillName });

  const origin = req.headers.get('host') ? `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('host')}` : '';
  const res = NextResponse.json({
    ok: true,
    created,
    unit_id: unitId,
    external_ref: externalRef || null,
    review_url: `${origin}/review/${unitId}`,
    verdict_url: `${origin}/api/v1/skill-review/${unitId}`,
  });
  for (const [k, v] of Object.entries(rateLimitHeaders(rl))) res.headers.set(k, v);
  logAccess({ ts: started, method: 'POST', path: '/api/v1/skill-review', status: 200, ms: Date.now() - started, site_key: siteKey, ip, rl });
  return res;
}
