// public contact intake — replaces all mailto: addresses on public pages.
// POST only, IP-rate-limited, stored in contact_submissions for triage.
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { checkBoth, clientIp, rateLimitHeaders } from '@/lib/ratelimit';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_TOPICS = new Set([
  'general', 'security', 'privacy', 'billing', 'legal', 'abuse',
  'paid-train', 'enterprise', 'growth',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = checkBoth(ip, 'public_contact');
  if (!rl.ok) {
    const res = NextResponse.json({ error: 'rate_limited', retry_after_s: rl.retry_after_s }, { status: 429 });
    for (const [k, v] of Object.entries(rateLimitHeaders(rl))) res.headers.set(k, v);
    return res;
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  const topic = String(body?.topic || '').trim().toLowerCase();
  const email = String(body?.email || '').trim();
  const message = String(body?.message || '').trim();
  const name = body?.name ? String(body.name).trim().slice(0, 120) : null;
  const org = body?.org ? String(body.org).trim().slice(0, 120) : null;
  const subject = body?.subject ? String(body.subject).trim().slice(0, 200) : null;
  // honeypot: if filled, silently accept and drop.
  const honeypot = String(body?.website || '');

  if (!ALLOWED_TOPICS.has(topic)) {
    return NextResponse.json({ error: 'invalid_topic' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }
  if (message.length < 10 || message.length > 5000) {
    return NextResponse.json({ error: 'message_length' }, { status: 400 });
  }

  const id = `cm_${crypto.randomBytes(8).toString('hex')}`;

  // honeypot tripped → return ok but mark as spam so we don't generate noise
  const status = honeypot ? 'spam' : 'new';

  db.prepare(`
    INSERT INTO contact_submissions
      (id, topic, name, email, org, subject, message, ip_hash, user_agent, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, topic, name, email, org, subject, message,
    hashIp(ip),
    String(req.headers.get('user-agent') || '').slice(0, 300),
    status,
    Date.now(),
  );

  if (status === 'new') {
    audit('contact', email, 'contact.submitted', 'contact_submissions', id, { topic, org: !!org });
  }

  return NextResponse.json({ ok: true, id });
}
