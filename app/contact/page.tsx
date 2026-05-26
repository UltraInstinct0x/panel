// public contact form — replaces all mailto: links on the site.
// Topic selector preserves intent (security, privacy, billing, legal, paid-train, ...).
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const COLORS = {
  bg: '#08080b', bg2: '#0f0f14',
  fg: '#e8e8ec', fgDim: '#9a9aa3', fgFaint: '#5b5b65',
  border: 'rgba(255,255,255,0.06)', borderStrong: 'rgba(255,255,255,0.12)',
  cyan: '#67e8f9', green: '#86efac', red: '#fca5a5',
};
const FONT = {
  body: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
  mono: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
};

const TOPICS: Array<{ value: string; label: string; hint?: string }> = [
  { value: 'general',    label: 'general',    hint: 'anything not covered below' },
  { value: 'security',   label: 'security',   hint: 'vulnerability disclosure — see SECURITY.md' },
  { value: 'privacy',    label: 'privacy',    hint: 'DSAR, deletion, GDPR questions' },
  { value: 'billing',    label: 'billing',    hint: 'invoices, payment, refunds' },
  { value: 'legal',      label: 'legal',      hint: 'contracts, DPA, BAA, SCC' },
  { value: 'abuse',      label: 'abuse',      hint: 'misuse or harm reports' },
  { value: 'paid-train', label: 'paid-train', hint: 'request access to paid training program' },
  { value: 'enterprise', label: 'enterprise', hint: 'enterprise tier inquiries' },
  { value: 'growth',     label: 'growth',     hint: 'growth tier inquiries' },
];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: COLORS.bg2,
  border: `1px solid ${COLORS.border}`, borderRadius: 6,
  color: COLORS.fg, fontFamily: FONT.mono, fontSize: 13, outline: 'none',
};

function ContactInner() {
  const params = useSearchParams();
  const initialTopic = (params?.get('topic') || 'general').toLowerCase();
  const validInitial = TOPICS.some(t => t.value === initialTopic) ? initialTopic : 'general';

  const [topic, setTopic] = useState(validInitial);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [org, setOrg] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — should stay empty
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string } | null>(null);

  useEffect(() => {
    const t = (params?.get('topic') || 'general').toLowerCase();
    if (TOPICS.some(x => x.value === t)) setTopic(t);
  }, [params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const r = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic, name: name || null, email,
          org: org || null,
          subject: subject || null,
          message,
          website, // honeypot
        }),
      });
      const j = await r.json();
      if (!r.ok) { setError(humanError(j.error)); return; }
      setDone({ id: j.id });
    } catch (e: any) {
      setError(e.message || 'network error');
    } finally { setSubmitting(false); }
  }

  if (done) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ color: COLORS.green, fontSize: 14, marginBottom: 10 }}>✓ message received</div>
          <div style={{ color: COLORS.fgDim, fontSize: 13, marginBottom: 18, maxWidth: 420, margin: '0 auto 18px' }}>
            we&apos;ll get back to you at the email you provided. typical response: 1–3 business days. reference:
          </div>
          <code style={{ fontFamily: FONT.mono, color: COLORS.cyan, background: COLORS.bg2, padding: '6px 12px', borderRadius: 6, fontSize: 12 }}>{done.id}</code>
        </div>
      </Shell>
    );
  }

  const topicMeta = TOPICS.find(t => t.value === topic);

  return (
    <Shell>
      <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <Field label="topic" required hint={topicMeta?.hint}>
          <select
            value={topic}
            onChange={e => setTopic(e.target.value)}
            style={inputStyle as any}
          >
            {TOPICS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>
        <Field label="email" required hint="we reply here">
          <Input value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
        </Field>
        <Field label="name" hint="optional">
          <Input value={name} onChange={setName} placeholder="" />
        </Field>
        <Field label="organization" hint="optional">
          <Input value={org} onChange={setOrg} placeholder="" />
        </Field>
        <Field label="subject" hint="optional, short summary">
          <Input value={subject} onChange={setSubject} placeholder="" />
        </Field>
        <Field label="message" required hint="10+ chars · what's up?">
          <Textarea value={message} onChange={setMessage} rows={8} />
        </Field>

        {/* honeypot — hidden from real users, bots fill it */}
        <div style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }} aria-hidden="true">
          <label>leave this empty
            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
          </label>
        </div>

        {error && <div style={{ background: '#2a0f12', color: COLORS.red, padding: 10, borderRadius: 6, fontSize: 12 }}>{error}</div>}

        <button
          type="submit"
          disabled={submitting || !email || message.length < 10}
          style={{
            padding: '12px 16px', background: COLORS.cyan, color: COLORS.bg,
            border: 'none', borderRadius: 6, fontFamily: FONT.body, fontSize: 13,
            fontWeight: 600, cursor: submitting ? 'wait' : 'pointer',
            opacity: (submitting || !email || message.length < 10) ? 0.5 : 1,
          }}
        >
          {submitting ? 'sending…' : 'send'}
        </button>

        <p style={{ color: COLORS.fgFaint, fontSize: 11, fontFamily: FONT.mono, marginTop: 4 }}>
          we don&apos;t publish staff email addresses. all contact goes through this form. abuse-reports and security disclosures are tracked the same way as billing inquiries — just pick the right topic above.
        </p>
      </form>
    </Shell>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<Shell><div style={{ color: COLORS.fgDim }}>loading…</div></Shell>}>
      <ContactInner />
    </Suspense>
  );
}

// ---------- shared bits ----------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{
      minHeight: '100vh', background: COLORS.bg, color: COLORS.fg,
      fontFamily: FONT.body, padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: COLORS.fg }}>contact</h1>
          <p style={{ color: COLORS.fgDim, fontSize: 13, margin: '6px 0 0' }}>
            send us a message — we&apos;ll reply by email.
          </p>
        </header>
        {children}
      </div>
    </main>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <label style={{ color: COLORS.fg, fontSize: 12, fontFamily: FONT.mono, textTransform: 'lowercase' }}>{label}{required && <span style={{ color: COLORS.red }}> *</span>}</label>
        {hint && <span style={{ color: COLORS.fgFaint, fontSize: 11 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
    />
  );
}

function Textarea({ value, onChange, rows = 4 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      style={{ ...inputStyle, resize: 'vertical', fontFamily: FONT.body, lineHeight: 1.5 } as any}
    />
  );
}

function humanError(code: string): string {
  switch (code) {
    case 'rate_limited':    return 'too many requests — try again in a minute.';
    case 'bad_json':        return 'malformed request.';
    case 'invalid_topic':   return 'pick a valid topic.';
    case 'invalid_email':   return 'please enter a valid email.';
    case 'message_length':  return 'message must be 10–5000 characters.';
    default:                return code || 'something went wrong.';
  }
}
