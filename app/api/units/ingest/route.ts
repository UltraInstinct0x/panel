// POST /api/units/ingest — operators push AI outputs into the rater pool.
// auth: HMAC-SHA256 over body, header X-Panel-Ingest-Sig=hex, X-Panel-Site-Key=<site_key>.
// secret resolution: env PANEL_INGEST_SECRET_<UPPER_SITE_KEY> (per-key), else PANEL_INGEST_SECRET (shared).
// rate-limited by site_key (existing checkBoth). No anonymous ingest.
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { checkBoth, clientIp, rateLimitHeaders } from '@/lib/ratelimit';
import { logAccess } from '@/lib/logger';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ensure link table once, at module init.
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
    logAccess({ ts: started, method: 'POST', path: '/api/units/ingest', status: 429, ms: Date.now() - started, site_key: siteKey, ip, rl });
    return res;
  }

  if (!siteKey || !sig) {
    return NextResponse.json({ error: 'missing_auth', detail: 'X-Panel-Site-Key + X-Panel-Ingest-Sig required' }, { status: 401 });
  }
  const secret = ingestSecretFor(siteKey);
  if (!secret) return NextResponse.json({ error: 'ingest_not_configured', site_key: siteKey }, { status: 401 });

  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  if (!timingEqual(expected, sig)) {
    audit('operator', siteKey, 'ingest.bad_sig', 'units', '', null);
    return NextResponse.json({ error: 'bad_signature' }, { status: 401 });
  }

  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  const items: any[] = Array.isArray(body) ? body : Array.isArray(body?.units) ? body.units : (body ? [body] : []);
  if (items.length === 0) return NextResponse.json({ error: 'empty_payload' }, { status: 400 });
  if (items.length > 100) return NextResponse.json({ error: 'too_many', max: 100 }, { status: 413 });

  // accept only ai_output_rating from operators for now (locked-down schema).
  const insert = db.prepare(
    'INSERT OR REPLACE INTO units (id, json, pool, is_honeypot, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const linkInsert = db.prepare(
    `INSERT OR IGNORE INTO ingested_unit_links (unit_id, site_key, external_ref, created_at) VALUES (?, ?, ?, ?)`,
  );

  const now = Date.now();
  const accepted: string[] = [];
  const rejected: { ref?: string; error: string }[] = [];

  const tx = db.transaction(() => {
    for (const raw of items) {
      const ext = String(raw?.external_ref || raw?.ref || '').slice(0, 200) || null;
      const type = String(raw?.type || 'ai_output_rating');
      if (type !== 'ai_output_rating') { rejected.push({ ref: ext || undefined, error: 'only ai_output_rating supported via ingest' }); continue; }
      const image_url = String(raw?.image_url || '');
      if (!/^https?:\/\//.test(image_url)) { rejected.push({ ref: ext || undefined, error: 'image_url must be http(s)' }); continue; }
      const source_agent = String(raw?.source_agent || siteKey).slice(0, 80);
      const prompt_context = String(raw?.prompt_context || '').slice(0, 400);
      const question = String(raw?.question || 'rate this output');

      // deterministic id: prefix + sha1(site_key|ext|image_url) — idempotent re-ingest.
      const seed = `${siteKey}|${ext || ''}|${image_url}`;
      const h = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 16);
      const id = `u_ing_${h}`;

      const unit = {
        id,
        type,
        pool: 'public' as const,
        source_agent,
        prompt_context,
        question,
        image_url,
        is_honeypot: false,
        est_seconds: 4,
      };
      insert.run(id, JSON.stringify(unit), 'public', 0, now);
      if (ext) linkInsert.run(id, siteKey, ext, now);
      accepted.push(id);
    }
  });
  tx();

  audit('operator', siteKey, 'ingest.ok', 'units', '', { accepted: accepted.length, rejected: rejected.length });

  const res = NextResponse.json({ ok: true, accepted: accepted.length, rejected: rejected.length, ids: accepted, errors: rejected });
  for (const [k, v] of Object.entries(rateLimitHeaders(rl))) res.headers.set(k, v);
  logAccess({ ts: started, method: 'POST', path: '/api/units/ingest', status: 200, ms: Date.now() - started, site_key: siteKey, ip, rl });
  return res;
}
