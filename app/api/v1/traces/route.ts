// WS-N: POST /v1/traces — ingest a trace, run splitter, spawn units.
// auth: site-key + HMAC (X-Panel-Ingest-Sig) + WS-M scrubber JWT (when required).
// body: { trace_id?, source_agent, blob }
// async: blob > 100KB → 202 + GET /v1/traces/[id]
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { scrubberRequiredFor } from '@/lib/db';
import { insertUnitsBulk, upsertTrace, updateTraceStatus } from '@/lib/queries';
import { checkBoth, clientIp, rateLimitHeaders } from '@/lib/ratelimit';
import { logAccess } from '@/lib/logger';
import { audit } from '@/lib/audit';
import { verifyAttestation, sha256Hex } from '@/lib/scrubber-attestation';
import { splitStructural, reMerge, Candidate } from '@/lib/splitter/structural';
import { llmSplitProseCandidates } from '@/lib/splitter/llm';
import { verifyIngestSecret, getIngestSecretHash } from '@/lib/operator-mint';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_PAYLOAD_BYTES = 256 * 1024;

function ingestSecretFor(siteKey: string): string | null {
  const envKey = `PANEL_INGEST_SECRET_${siteKey.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  return process.env[envKey] || process.env.PANEL_INGEST_SECRET || null;
}
function timingEqual(a: string, b: string): boolean {
  const A = Buffer.from(a, 'hex'); const B = Buffer.from(b, 'hex');
  if (A.length === 0 || A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

interface SplitOutcome {
  unit_ids: string[];
  structural_count: number;
  llm_count: number;
  skipped_count: number;
}

async function runSplitterAndPersist(traceId: string, body: any): Promise<SplitOutcome> {
  const blob = body?.blob ?? body;
  const sourceAgent = String(body?.source_agent ?? 'unknown').slice(0, 80);
  const structural = reMerge(splitStructural(blob));

  const proseHandoffs = structural.candidates.filter(c => c.type === 'prose_handoff');
  const structuralEmit = structural.candidates.filter(c => c.type !== 'prose_handoff');

  let llmEmit: Candidate[] = [];
  let llm_count = 0, skipped_count = 0;
  if (proseHandoffs.length > 0) {
    const r = await llmSplitProseCandidates(proseHandoffs);
    llmEmit = r.emitted;
    llm_count = r.llm_count;
    skipped_count = r.skipped_count;
  }

  const all = [...structuralEmit, ...llmEmit];
  // WS-T: migrated to kysely (queries.insertUnitsBulk)
  const now = Date.now();
  const unit_ids: string[] = [];
  const allowedTypes = new Set([
    'step_validity','skill_diff','hallucination_flag','pairwise_trace',
  ]);
  const rows: Parameters<typeof insertUnitsBulk>[0] = [];
  all.forEach((c, i) => {
    if (!allowedTypes.has(c.type as string)) return;
    const id = `u_tr_${traceId.slice(0, 8)}_${i}_${crypto.randomBytes(3).toString('hex')}`;
    const unit = {
      id,
      type: c.type,
      pool: 'public',
      source_agent: sourceAgent,
      prompt_context: '',
      question: c.payload?.question ?? '',
      ...c.payload,
      est_seconds: 10,
      trace_id: traceId,
      parent_span_path: c.parent_span_path,
      source_token_range: c.source_token_range,
    };
    rows.push({
      id,
      json: JSON.stringify(unit),
      pool: 'public',
      is_honeypot: 0,
      created_at: now,
      trace_id: traceId,
      parent_span_path: c.parent_span_path,
    });
    unit_ids.push(id);
  });
  await insertUnitsBulk(rows);

  return { unit_ids, structural_count: structuralEmit.length, llm_count, skipped_count };
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const ip = clientIp(req);
  const siteKey = req.headers.get('x-panel-site-key') || '';
  const sig = req.headers.get('x-panel-ingest-sig') || '';
  const raw = await req.text();

  if (raw.length > MAX_PAYLOAD_BYTES) {
    logAccess({ ts: started, method: 'POST', path: '/v1/traces', status: 413, ms: Date.now() - started, site_key: siteKey, ip });
    return NextResponse.json({ error: 'payload_too_large', max_bytes: MAX_PAYLOAD_BYTES }, { status: 413 });
  }

  const rl = checkBoth(ip, siteKey);
  if (!rl.ok) {
    const res = NextResponse.json({ error: 'rate_limited', scope: rl.scope, retry_after_s: rl.retry_after_s }, { status: 429 });
    for (const [k, v] of Object.entries(rateLimitHeaders(rl))) res.headers.set(k, v);
    logAccess({ ts: started, method: 'POST', path: '/v1/traces', status: 429, ms: Date.now() - started, site_key: siteKey, ip, rl });
    return res;
  }

  if (!siteKey || !sig) {
    return NextResponse.json({ error: 'missing_auth' }, { status: 401 });
  }
  const envSecret = ingestSecretFor(siteKey);
  const dbHash = getIngestSecretHash(siteKey);
  if (!envSecret && !dbHash) return NextResponse.json({ error: 'ingest_not_configured', site_key: siteKey }, { status: 401 });

  let authed = false;
  if (envSecret) {
    const expected = crypto.createHmac('sha256', envSecret).update(raw).digest('hex');
    if (timingEqual(expected, sig)) authed = true;
  }
  if (!authed && dbHash) {
    // sig format with db-stored secrets: the caller can either send the raw
    // secret as a Bearer-ish header, OR (preferred) send HMAC(secret, raw).
    // We try both: header `x-panel-ingest-secret` for raw, sig for hmac.
    const rawSecretHeader = req.headers.get('x-panel-ingest-secret');
    if (rawSecretHeader && verifyIngestSecret(rawSecretHeader, dbHash)) {
      const expected = crypto.createHmac('sha256', rawSecretHeader).update(raw).digest('hex');
      if (timingEqual(expected, sig)) authed = true;
    }
  }
  if (!authed) {
    audit('operator', siteKey, 'traces.bad_sig', 'traces', '', null);
    return NextResponse.json({ error: 'bad_signature' }, { status: 401 });
  }

  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  // WS-M scrubber JWT gate
  let attJti: string | null = null;
  const scrubberRequired = scrubberRequiredFor(siteKey);
  if (scrubberRequired) {
    const attHeader = req.headers.get('x-scrubber-attestation');
    if (!attHeader) {
      audit('operator', siteKey, 'traces.scrubber_attestation_missing', 'traces', '', null);
      return NextResponse.json({ error: 'scrubber_attestation_required' }, { status: 422 });
    }
    const v = verifyAttestation(attHeader, { expectedOutputHash: sha256Hex(raw) });
    if (!v.ok) {
      const code = `scrubber_attestation_${v.error}`;
      audit('operator', siteKey, `traces.${code}`, 'traces', '', { reason: v.error });
      return NextResponse.json({ error: code }, { status: 422 });
    }
    attJti = v.payload.jti;
  } else {
    audit('operator', siteKey, 'traces.scrubber_bypassed', 'traces', '', { bytes: raw.length });
  }

  const trace_id = String(body?.trace_id || `tr_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`);
  const blobJson = JSON.stringify(body?.blob ?? body);
  const blobHash = sha256Hex(blobJson);

  // WS-T: upsert trace row via kysely (queries.upsertTrace)
  await upsertTrace({
    trace_id,
    operator_id: siteKey,
    source_agent: String(body?.source_agent ?? 'unknown'),
    raw_blob_hash: blobHash,
    sanitized_at: Date.now(),
    ingested_at: Date.now(),
    scrubber_attestation_jti: attJti,
    blob_size: blobJson.length,
    status: 'pending',
    result_json: null,
    blob_json: blobJson,
  });

  // launch-blocker T5: previous implementation returned 202 then ran an
  // unawaited IIFE that silently lost work on container recycle. We now run
  // splitting + persistence synchronously and return 200 with the result.
  // TODO(post-pilot): replace with a durable queue (BullMQ / pg-boss / etc.)
  // once we have multi-worker traffic that warrants async ingestion. See the
  // launch-readiness audit (P0 item #5) for the long-term plan.
  const out = await runSplitterAndPersist(trace_id, body);
  await updateTraceStatus(trace_id, 'done', JSON.stringify(out));
  audit('operator', siteKey, 'traces.ok', 'traces', trace_id, { units: out.unit_ids.length, structural: out.structural_count, llm: out.llm_count });

  const res = NextResponse.json({ trace_id, ...out });
  for (const [k, v] of Object.entries(rateLimitHeaders(rl))) res.headers.set(k, v);
  logAccess({ ts: started, method: 'POST', path: '/v1/traces', status: 200, ms: Date.now() - started, site_key: siteKey, ip, rl });
  return res;
}
