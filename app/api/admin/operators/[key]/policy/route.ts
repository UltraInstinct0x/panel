// WS-Q: GET/PUT /api/admin/operators/[key]/policy — tier_policy editor.
// validates the policy JSON shape; logs every change to events_audit.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getTierPolicyJson, setTierPolicyJson, getSiteKey, upsertSiteKey } from '@/lib/db';
import { DEFAULT_POLICY, TierPolicy } from '@/lib/tier-ladder';
import { logAudit } from '@/lib/operator-audit';

export const dynamic = 'force-dynamic';

function loadPolicy(siteKey: string): TierPolicy {
  const raw = getTierPolicyJson(siteKey);
  if (!raw) return { ...DEFAULT_POLICY };
  try { return { ...DEFAULT_POLICY, ...JSON.parse(raw) }; } catch { return { ...DEFAULT_POLICY }; }
}

type ValidateResult = { ok: true; policy: TierPolicy } | { ok: false; error: string };

function validate(p: any): ValidateResult {
  if (!p || typeof p !== 'object') return { ok: false, error: 'policy_not_object' };
  const out: TierPolicy = { ...DEFAULT_POLICY };
  const numKeys = ['t_c0_max', 't_c1_max', 't_c2_max', 'min_trust'] as const;
  for (const k of numKeys) {
    if (p[k] === undefined) continue;
    const n = Number(p[k]);
    if (!Number.isFinite(n) || n < 0 || n > 1) return { ok: false, error: `bad_${k}` };
    out[k] = n;
  }
  if (p.auto_c0 !== undefined) out.auto_c0 = !!p.auto_c0;
  if (p.escalate_on_fail !== undefined) out.escalate_on_fail = !!p.escalate_on_fail;
  // monotonicity: c0 < c1 < c2
  if (!(out.t_c0_max <= out.t_c1_max && out.t_c1_max <= out.t_c2_max)) {
    return { ok: false, error: 'thresholds_not_monotonic' };
  }
  return { ok: true, policy: out };
}

export async function GET(req: NextRequest, ctx: { params: { key: string } }) {
  const a = await requireAdmin(req); if (!a.ok) return a.res;
  return NextResponse.json({ ok: true, policy: loadPolicy(ctx.params.key), defaults: DEFAULT_POLICY });
}

export async function PUT(req: NextRequest, ctx: { params: { key: string } }) {
  const a = await requireAdmin(req); if (!a.ok) return a.res;
  const key = ctx.params.key;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const v: ValidateResult = validate(body?.policy ?? body);
  if (v.ok === false) return NextResponse.json({ error: v.error }, { status: 400 });
  const before = loadPolicy(key);
  // ensure site_keys row exists so the policy has somewhere to live.
  if (!getSiteKey(key)) upsertSiteKey(key, true, null as any);
  setTierPolicyJson(key, JSON.stringify(v.policy));
  const after = loadPolicy(key);
  logAudit({
    event: 'operator.policy.update',
    actor: a.admin_key,
    site_key: key,
    before,
    after,
  });
  return NextResponse.json({ ok: true, policy: after });
}
