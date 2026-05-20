// WS-U: /onboard — public operator application form.
'use client';

import React, { useState } from 'react';

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

export default function OnboardPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [org, setOrg] = useState('');
  const [intendedUse, setIntendedUse] = useState('');
  const [requestedTier, setRequestedTier] = useState('free');
  const [scrubberRequired, setScrubberRequired] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const r = await fetch('/api/onboard', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name, email, org: org || null, intended_use: intendedUse,
          requested_tier: requestedTier, scrubber_required: scrubberRequired,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setError(humanError(j.error)); return; }
      setDone({ id: j.application_id });
    } catch (e: any) {
      setError(e.message || 'network error');
    } finally { setSubmitting(false); }
  }

  if (done) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ color: COLORS.green, fontSize: 14, marginBottom: 8 }}>application submitted</div>
          <div style={{ color: COLORS.fgDim, fontSize: 13, marginBottom: 16 }}>
            we'll review and email you. reference:
          </div>
          <code style={{ fontFamily: FONT.mono, color: COLORS.cyan, background: COLORS.bg2, padding: '6px 12px', borderRadius: 6, fontSize: 12 }}>{done.id}</code>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <Field label="name" required>
          <Input value={name} onChange={setName} placeholder="ada lovelace" />
        </Field>
        <Field label="email" required>
          <Input value={email} onChange={setEmail} placeholder="ada@analytical.engine" type="email" />
        </Field>
        <Field label="organization" hint="optional">
          <Input value={org} onChange={setOrg} placeholder="" />
        </Field>
        <Field label="what are you building?" required hint="20+ chars · what product, what kind of agent traffic, expected volume">
          <Textarea value={intendedUse} onChange={setIntendedUse} rows={5} />
        </Field>
        <Field label="tier" hint="free for now, all approvals start free">
          <select value={requestedTier} onChange={e => setRequestedTier(e.target.value)} style={inputStyle as any}>
            <option value="free">free</option>
            <option value="starter">starter</option>
          </select>
        </Field>
        <Field label="scrubber" hint="strongly recommended; disable only if you've already PII-scrubbed traces yourself">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: COLORS.fg, fontSize: 13 }}>
            <input type="checkbox" checked={scrubberRequired} onChange={e => setScrubberRequired(e.target.checked)} />
            require scrubber attestation on all ingest
          </label>
        </Field>

        {error && <div style={{ background: '#2a0f12', color: COLORS.red, padding: 10, borderRadius: 6, fontSize: 12 }}>{error}</div>}

        <button type="submit" disabled={submitting} style={{
          background: COLORS.cyan, color: '#001316', border: 'none', borderRadius: 6,
          padding: '10px 16px', fontSize: 13, cursor: submitting ? 'wait' : 'pointer',
          fontFamily: FONT.body, fontWeight: 500, marginTop: 4, opacity: submitting ? 0.6 : 1,
        }}>{submitting ? 'submitting…' : 'apply'}</button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ background: COLORS.bg, color: COLORS.fg, minHeight: '100vh', fontFamily: FONT.body, fontSize: 13 }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '60px 24px' }}>
        <header style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: COLORS.fgFaint, letterSpacing: 0.4, textTransform: 'uppercase' }}>panel</div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: '4px 0 6px', letterSpacing: -0.3 }}>operator application</h1>
          <p style={{ color: COLORS.fgDim, fontSize: 13, margin: 0 }}>
            tell us what you're building. we manually approve to keep the rater pool clean. reply within 24h.
          </p>
        </header>
        {children}
      </div>
    </main>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 5, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <label style={{ color: COLORS.fg, fontSize: 12, fontWeight: 500 }}>{label}{required && <span style={{ color: COLORS.cyan }}> *</span>}</label>
        {hint && <span style={{ color: COLORS.fgFaint, fontSize: 11 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: COLORS.bg2, color: COLORS.fg,
  border: `1px solid ${COLORS.border}`, borderRadius: 6,
  padding: '9px 12px', fontSize: 13, fontFamily: FONT.body,
  outline: 'none',
};

function Input({ value, onChange, placeholder, type }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />;
}
function Textarea({ value, onChange, rows }: { value: string; onChange: (v: string) => void; rows: number }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} style={{ ...inputStyle, resize: 'vertical', fontFamily: FONT.body }} />;
}

function humanError(code: string): string {
  switch (code) {
    case 'name_required': return 'name is required';
    case 'email_invalid': return 'that email looks off';
    case 'intended_use_too_short': return 'tell us a bit more — at least 20 characters';
    case 'rate_limited': return 'too many applications from this email in the last 24h. try later.';
    case 'bad_json': return 'request format error';
    default: return code || 'submit failed';
  }
}
