// WS-U: /admin/onboard — application review queue (approve/reject + show minted secret once).
'use client';

import React, { useEffect, useState } from 'react';

const COLORS = {
  bg: '#08080b', bg2: '#0f0f14',
  fg: '#e8e8ec', fgDim: '#9a9aa3', fgFaint: '#5b5b65',
  border: 'rgba(255,255,255,0.06)', borderStrong: 'rgba(255,255,255,0.12)',
  cyan: '#67e8f9', green: '#86efac', red: '#fca5a5', amber: '#fcd34d',
};
const FONT = {
  body: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
  mono: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
};

interface App {
  id: string; name: string; email: string; org: string | null;
  intended_use: string; requested_tier: string; scrubber_required: 0 | 1;
  status: string; created_at: number;
  decided_at: number | null; minted_site_key: string | null; rejection_reason: string | null;
}

interface Minted { site_key: string; ingest_secret: string; scrubber_required: boolean; application_id: string; }

export default function OnboardQueuePage() {
  const [apps, setApps] = useState<App[]>([]);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minted, setMinted] = useState<Minted | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionText, setRejectionText] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/onboard/applications?status=${statusFilter}`, { credentials: 'include' });
      if (!r.ok) throw new Error(`http ${r.status}`);
      const j = await r.json();
      setApps(j.applications || []);
    } catch (e: any) {
      setError(e.message || 'failed');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  async function approve(id: string) {
    setError(null);
    const r = await fetch('/api/admin/onboard/applications', {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ application_id: id, action: 'approve' }),
    });
    const j = await r.json();
    if (!r.ok) { setError(j.error || 'approve failed'); return; }
    setMinted({ ...j.minted, application_id: j.application_id });
    load();
  }
  async function reject(id: string, reason: string) {
    setError(null);
    const r = await fetch('/api/admin/onboard/applications', {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ application_id: id, action: 'reject', reason }),
    });
    const j = await r.json();
    if (!r.ok) { setError(j.error || 'reject failed'); return; }
    setRejectingId(null); setRejectionText('');
    load();
  }

  return (
    <main style={{ background: COLORS.bg, color: COLORS.fg, minHeight: '100vh', fontFamily: FONT.body, fontSize: 13, lineHeight: 1.5 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 28px' }}>
        <header style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: COLORS.fgFaint, letterSpacing: 0.4, textTransform: 'uppercase' }}>panel · admin</div>
          <h1 style={{ fontSize: 18, fontWeight: 500, margin: '4px 0 2px', letterSpacing: -0.2 }}>onboard queue</h1>
          <div style={{ color: COLORS.fgDim, fontSize: 12 }}>operator applications · approve mints a site_key + ingest_secret</div>
        </header>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              background: statusFilter === s ? COLORS.bg2 : 'transparent',
              color: statusFilter === s ? COLORS.cyan : COLORS.fgDim,
              border: `1px solid ${statusFilter === s ? COLORS.borderStrong : COLORS.border}`,
              borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
              fontFamily: FONT.body, textTransform: 'lowercase',
            }}>{s}</button>
          ))}
        </div>

        {error && <div style={{ background: '#2a0f12', color: COLORS.red, padding: 10, borderRadius: 6, marginBottom: 16, fontSize: 12 }}>{error}</div>}

        {minted && <MintedCard m={minted} onClose={() => setMinted(null)} />}

        <div style={{ background: COLORS.bg2, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 4 }}>
          {loading ? (
            <div style={{ padding: 24, color: COLORS.fgDim }}>loading…</div>
          ) : apps.length === 0 ? (
            <div style={{ padding: 24, color: COLORS.fgFaint }}>no {statusFilter} applications.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: COLORS.fgFaint, fontWeight: 500 }}>
                  <Th>applicant</Th><Th>org</Th><Th>tier</Th><Th>submitted</Th><Th>status</Th><Th /></tr>
              </thead>
              <tbody>
                {apps.map(a => (
                  <React.Fragment key={a.id}>
                    <tr style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      <Td>
                        <div style={{ color: COLORS.fg }}>{a.name}</div>
                        <div style={{ color: COLORS.fgDim, fontFamily: FONT.mono, fontSize: 11 }}>{a.email}</div>
                      </Td>
                      <Td><span style={{ color: COLORS.fg }}>{a.org || <span style={{ color: COLORS.fgFaint }}>—</span>}</span></Td>
                      <Td><span style={{ fontFamily: FONT.mono, color: COLORS.cyan }}>{a.requested_tier}</span></Td>
                      <Td><span style={{ fontFamily: FONT.mono, color: COLORS.fgDim }}>{new Date(a.created_at).toISOString().slice(0, 16).replace('T', ' ')}</span></Td>
                      <Td><StatusChip s={a.status} /></Td>
                      <Td>
                        {a.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={() => approve(a.id)} style={btnPrimary}>approve</button>
                            <button onClick={() => { setRejectingId(a.id); setRejectionText(''); }} style={btnGhost}>reject</button>
                          </div>
                        ) : a.minted_site_key ? (
                          <span style={{ fontFamily: FONT.mono, fontSize: 11, color: COLORS.cyan }}>{a.minted_site_key}</span>
                        ) : a.rejection_reason ? (
                          <span style={{ color: COLORS.red, fontSize: 11 }}>{a.rejection_reason}</span>
                        ) : null}
                      </Td>
                    </tr>
                    <tr style={{ borderTop: `1px dashed ${COLORS.border}` }}>
                      <td colSpan={6} style={{ padding: '6px 12px 12px 12px', color: COLORS.fgDim, fontSize: 12, whiteSpace: 'pre-wrap' }}>{a.intended_use}</td>
                    </tr>
                    {rejectingId === a.id && (
                      <tr><td colSpan={6} style={{ padding: 12, background: '#0c0c10' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input value={rejectionText} onChange={e => setRejectionText(e.target.value)} placeholder="rejection reason…" style={{
                            flex: 1, background: COLORS.bg, color: COLORS.fg, border: `1px solid ${COLORS.borderStrong}`,
                            borderRadius: 6, padding: '6px 10px', fontSize: 12, fontFamily: FONT.body,
                          }} />
                          <button onClick={() => reject(a.id, rejectionText || 'unspecified')} style={btnPrimary}>confirm reject</button>
                          <button onClick={() => setRejectingId(null)} style={btnGhost}>cancel</button>
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}

function Th(props: { children?: React.ReactNode }) {
  return <th style={{ padding: '10px 12px', fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', textAlign: 'left' }}>{props.children}</th>;
}
function Td(props: { children?: React.ReactNode }) {
  return <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>{props.children}</td>;
}
function StatusChip({ s }: { s: string }) {
  const c = s === 'pending' ? COLORS.amber : s === 'approved' ? COLORS.green : COLORS.red;
  return <span style={{ color: c, fontFamily: FONT.mono, fontSize: 11, padding: '2px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 999 }}>{s}</span>;
}
const btnPrimary: React.CSSProperties = {
  background: COLORS.cyan, color: '#001316', border: 'none', borderRadius: 6,
  padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontFamily: FONT.body, fontWeight: 500,
};
const btnGhost: React.CSSProperties = {
  background: 'transparent', color: COLORS.fgDim, border: `1px solid ${COLORS.border}`,
  borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontFamily: FONT.body,
};

function MintedCard({ m, onClose }: { m: Minted; onClose: () => void }) {
  return (
    <div style={{
      background: '#0d1a1f', border: `1px solid ${COLORS.cyan}`, borderRadius: 8,
      padding: 16, marginBottom: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ color: COLORS.cyan, fontWeight: 500, fontSize: 13 }}>
          minted · copy now (ingest_secret won't be shown again)
        </div>
        <button onClick={onClose} style={{ ...btnGhost, color: COLORS.fgDim }}>dismiss</button>
      </div>
      <div style={{ fontFamily: FONT.mono, fontSize: 12, color: COLORS.fg, display: 'grid', gap: 4 }}>
        <div><span style={{ color: COLORS.fgDim }}>site_key:       </span>{m.site_key}</div>
        <div><span style={{ color: COLORS.fgDim }}>ingest_secret:  </span>{m.ingest_secret}</div>
        <div><span style={{ color: COLORS.fgDim }}>scrubber:       </span>{m.scrubber_required ? 'required' : 'carve-out'}</div>
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: COLORS.fgDim }}>
        send the operator: site_key (public) + ingest_secret (private). they install panel SDK and set both as env vars.
      </div>
    </div>
  );
}
