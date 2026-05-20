// POST /api/units/ingest — operators push AI outputs into the rater pool.
// auth: HMAC-SHA256 over body, header X-Panel-Ingest-Sig=hex, X-Panel-Site-Key=<site_key>.
// secret resolution: env PANEL_INGEST_SECRET_<UPPER_SITE_KEY> (per-key), else PANEL_INGEST_SECRET (shared).
// rate-limited by site_key (existing checkBoth). No anonymous ingest.
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, scrubberRequiredFor } from '@/lib/db';
import { checkBoth, clientIp, rateLimitHeaders } from '@/lib/ratelimit';
import { logAccess } from '@/lib/logger';
import { audit } from '@/lib/audit';
import { verifyAttestation, sha256Hex } from '@/lib/scrubber-attestation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function defaultQuestionFor(type: string): string {
  switch (type) {
    case 'ai_output_rating': return 'rate this output';
    case 'process_output_rating': return 'rate this agent output';
    case 'skill_diff_review': return 'should this skill update ship?';
    case 'prompt_rewrite_pair': return 'which phrasing is better?';
    case 'media_quality': return 'rate this generated media';
    case 'media_origin': return 'is this AI-generated or real?';
    default: return 'rate this';
  }
}

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

  // WS-M: scrubber attestation gate. Only third-party keys (scrubber_required=true) need it.
  const scrubberRequired = scrubberRequiredFor(siteKey);
  const attHeader = req.headers.get('x-scrubber-attestation');
  if (scrubberRequired) {
    if (!attHeader) {
      audit('operator', siteKey, 'ingest.scrubber_attestation_missing', 'units', '', null);
      return NextResponse.json({ error: 'scrubber_attestation_required', detail: 'X-Scrubber-Attestation header required for this site_key' }, { status: 422 });
    }
    const expectedHash = sha256Hex(raw);
    const v = verifyAttestation(attHeader, { expectedOutputHash: expectedHash });
    if (!v.ok) {
      const codeMap: Record<string, string> = {
        expired: 'scrubber_attestation_stale',
        stale: 'scrubber_attestation_stale',
        hash_mismatch: 'scrubber_attestation_hash_mismatch',
        bad_signature: 'scrubber_attestation_bad_signature',
        malformed: 'scrubber_attestation_malformed',
        missing: 'scrubber_attestation_required',
        no_secret: 'scrubber_attestation_misconfigured',
      };
      const code = codeMap[v.error] ?? 'scrubber_attestation_invalid';
      audit('operator', siteKey, `ingest.${code}`, 'units', '', { reason: v.error });
      return NextResponse.json({ error: code }, { status: 422 });
    }
  } else {
    // carve-out: pre-sanitized first-party key. log every use so it can't become a silent bypass.
    audit('operator', siteKey, 'ingest.scrubber_bypassed', 'units', '', {
      reason: 'site_key has scrubber_required=false',
      bytes: raw.length,
    });
  }

  const items: any[] = Array.isArray(body) ? body : Array.isArray(body?.units) ? body.units : (body ? [body] : []);
  if (items.length === 0) return NextResponse.json({ error: 'empty_payload' }, { status: 400 });
  if (items.length > 100) return NextResponse.json({ error: 'too_many', max: 100 }, { status: 413 });

  const ALLOWED_INGEST_TYPES = new Set([
    'ai_output_rating',
    'skill_diff_review',
    'process_output_rating',
    'prompt_rewrite_pair',
    'media_quality',
    'media_origin',
  ]);

  // accept whitelisted unit types from operators (locked-down schema).
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
      if (!ALLOWED_INGEST_TYPES.has(type)) {
        rejected.push({ ref: ext || undefined, error: `type ${type} not allowed via ingest` });
        continue;
      }

      const source_agent = String(raw?.source_agent || siteKey).slice(0, 80);
      const prompt_context = String(raw?.prompt_context || '').slice(0, 2000);
      const question = String(raw?.question || defaultQuestionFor(type));

      // per-type required-field validation + seed for id
      let image_url: string | undefined;
      let passage: string | undefined;
      let diff: string | undefined;
      let binary: { yes: string; no: string } | undefined;
      let choices: { label: string; text: string }[] | undefined;
      let media_url: string | undefined;
      let media_type: 'image' | 'video' | undefined;
      let poster_url: string | undefined;
      let seedExtra = '';

      if (type === 'ai_output_rating') {
        image_url = String(raw?.image_url || '');
        if (!/^https?:\/\//.test(image_url)) {
          rejected.push({ ref: ext || undefined, error: 'image_url must be http(s)' });
          continue;
        }
        seedExtra = image_url;
      } else if (type === 'process_output_rating') {
        passage = String(raw?.passage || raw?.text || '').slice(0, 8000);
        if (!passage) {
          rejected.push({ ref: ext || undefined, error: 'passage required for process_output_rating' });
          continue;
        }
        seedExtra = passage.slice(0, 200);
      } else if (type === 'skill_diff_review') {
        diff = String(raw?.diff || '').slice(0, 8000);
        if (!diff) {
          rejected.push({ ref: ext || undefined, error: 'diff required for skill_diff_review' });
          continue;
        }
        binary = { yes: 'ship it', no: 'reject' };
        seedExtra = diff.slice(0, 200);
      } else if (type === 'prompt_rewrite_pair') {
        const rawChoices = Array.isArray(raw?.choices) ? raw.choices : [];
        if (rawChoices.length < 2) {
          rejected.push({ ref: ext || undefined, error: 'prompt_rewrite_pair needs 2 choices' });
          continue;
        }
        choices = rawChoices.slice(0, 2).map((c: any, i: number) => ({
          label: String(c?.label || (i === 0 ? 'A' : 'B')).slice(0, 8),
          text: String(c?.text || '').slice(0, 2000),
        })) as { label: string; text: string }[];
        if (!choices![0].text || !choices![1].text) {
          rejected.push({ ref: ext || undefined, error: 'prompt_rewrite_pair choices need text' });
          continue;
        }
        seedExtra = `${choices![0].text}|${choices![1].text}`.slice(0, 200);
      } else if (type === 'media_quality' || type === 'media_origin') {
        media_url = String(raw?.media_url || raw?.url || '');
        if (!/^https?:\/\//.test(media_url)) {
          rejected.push({ ref: ext || undefined, error: 'media_url must be http(s)' });
          continue;
        }
        const mt = String(raw?.media_type || 'image').toLowerCase();
        if (mt !== 'image' && mt !== 'video') {
          rejected.push({ ref: ext || undefined, error: 'media_type must be image|video' });
          continue;
        }
        media_type = mt as 'image' | 'video';
        const p = String(raw?.poster_url || '');
        if (p && /^https?:\/\//.test(p)) poster_url = p;
        seedExtra = `${media_type}|${media_url}`.slice(0, 200);
      }

      // deterministic id: prefix + sha1(site_key|ext|type|seedExtra) — idempotent re-ingest.
      const seed = `${siteKey}|${ext || ''}|${type}|${seedExtra}`;
      const h = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 16);
      const id = `u_ing_${h}`;

      const unit: any = {
        id,
        type,
        pool: 'public' as const,
        source_agent,
        prompt_context,
        question,
        is_honeypot: false,
        est_seconds: type === 'skill_diff_review' ? 8 : type === 'process_output_rating' ? 6 : type === 'media_quality' ? 5 : type === 'media_origin' ? 4 : 4,
      };
      if (image_url) unit.image_url = image_url;
      if (passage) unit.passage = passage;
      if (diff) unit.diff = diff;
      if (binary) unit.binary = binary;
      if (choices) unit.choices = choices;
      if (media_url) unit.media_url = media_url;
      if (media_type) unit.media_type = media_type;
      if (poster_url) unit.poster_url = poster_url;

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
