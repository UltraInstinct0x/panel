// WS-U: public operator application intake. POST only, IP-rate-limited.
import { NextRequest, NextResponse } from 'next/server';
import { createApplication } from '@/lib/operator-mint';
import { checkBoth, clientIp, rateLimitHeaders } from '@/lib/ratelimit';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = checkBoth(ip, 'public_onboard');
  if (!rl.ok) {
    const res = NextResponse.json({ error: 'rate_limited', retry_after_s: rl.retry_after_s }, { status: 429 });
    for (const [k, v] of Object.entries(rateLimitHeaders(rl))) res.headers.set(k, v);
    return res;
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  const r = createApplication({
    name: body?.name,
    email: body?.email,
    org: body?.org,
    intended_use: body?.intended_use,
    requested_tier: body?.requested_tier,
    scrubber_required: body?.scrubber_required !== false,
    client_ip: ip,
  });

  if (!r.ok) {
    return NextResponse.json({ error: r.reason }, { status: 400 });
  }
  audit('operator', body?.email || 'unknown', 'application.submitted', 'operator_applications', r.id, null);
  return NextResponse.json({ ok: true, application_id: r.id });
}
