// /admin/contact — triage queue for contact_submissions
'use client';

import React, { useEffect, useState, useMemo } from 'react';

const COLORS = {
  bg: '#08080b', bg2: '#0f0f14',
  fg: '#e8e8ec', fgDim: '#9a9aa3', fgFaint: '#5b5b65',
  border: 'rgba(255,255,255,0.06)', borderStrong: 'rgba(255,255,255,0.12)',
  cyan: '#67e8f9', green: '#86efac', red: '#fca5a5', amber: '#fcd34d', purple: '#c4b5fd',
};
const FONT = {
  body: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
  mono: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
};

type Status = 'new' | 'triaged' | 'resolved' | 'spam';
type TopicFilter = 'all' | 'general' | 'security' | 'privacy' | 'billing' | 'legal' | 'abuse' | 'paid-train' | 'enterprise' | 'growth';

interface Submission {
  id: string;
  topic: string;
  name: string | null;
  email: string | null;
  org: string | null;
  subject: string | null;
  message: string;
  ip_hash: string | null;
  user_agent: string | null;
  status: Status;
  created_at: number;
  handled_at: number | null;
  handled_by: string | null;
  notes: string | null;
}

const TOPIC_COLOR: Record<string, string> = {
  security: COLORS.red,
  privacy: COLORS.purple,
  billing: COLORS.amber,
  legal: COLORS.amber,
  abuse: COLORS.red,
  general: COLORS.fgDim,
  'paid-train': COLORS.green,
  enterprise: COLORS.cyan,
  growth: COLORS.cyan,
};

function fmtTs(ts: number | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toISOString().replace('T', ' ').slice(0, 16) + 'z';
}

export default function ContactQueuePage() {
  const [rows, setRows] = useState<Submission[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({ new: 0, triaged: 0, resolved: 0, spam: 0 });
  const [status, setStatus] = useState<Status | 'all'>('new');
  const [topic, setTopic] = useState<TopicFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/contact?status=${status}&topic=${topic}`, { credentials: 'include' });
      if (!r.ok) throw new Error(`http ${r.status}`);
      const j = await r.json();
      setRows(j.submissions || []);
      setSummary(j.summary || {});
    } catch (e: any) {
      setError(e.message || 'failed to load');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, topic]);

  async function setRowStatus(id: string, newStatus: Status) {
    setBusyId(id);
    setError(null);
    try {
      const r = await fetch('/api/admin/contact', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, notes: notesDraft[id] || null }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'update failed'); return; }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const topics: TopicFilter[] = useMemo(() => [
    'all', 'general', 'security', 'privacy', 'billing', 'legal', 'abuse', 'paid-train', 'enterprise', 'growth',
  ], []);

  return (
    <main style={{ background: COLORS.bg, color: COLORS.fg, minHeight: '100vh', fontFamily: FONT.body, fontSize: 13, lineHeight: 1.5 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 28px' }}>
        <header style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: COLORS.fgFaint, letterSpacing: 0.4, textTransform: 'uppercase' }}>panel · admin</div>
          <h1 style={{ fontSize: 18, fontWeight: 500, margin: '4px 0 2px', letterSpacing: -0.2 }}>contact queue</h1>
          <div style={{ color: COLORS.fgDim, fontSize: 12 }}>
            inbound submissions from <span style={{ fontFamily: FONT.mono }}>/contact</span> · triage and resolve
          </div>
        </header>

        {/* summary chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {(['new', 'triaged', 'resolved', 'spam', 'all'] as const).map(s => {
            const active = status === s;
            const count = s === 'all' ? Object.values(summary).reduce((a, b) => a + b, 0) : (summary[s] || 0);
            return (
              <button key={s} onClick={() => setStatus(s)} style={{
                background: active ? COLORS.bg2 : 'transparent',
                color: active ? (s === 'new' ? COLORS.amber : s === 'resolved' ? COLORS.green : s === 'spam' ? COLORS.red : COLORS.cyan) : COLORS.fgDim,
                border: `1px solid ${active ? COLORS.borderStrong : COLORS.border}`,
                borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                fontFamily: FONT.body, textTransform: 'lowercase',
              }}>
                {s} <span style={{ opacity: 0.6, marginLeft: 4 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* topic filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {topics.map(t => {
            const active = topic === t;
            return (
              <button key={t} onClick={() => setTopic(t)} style={{
                background: active ? COLORS.bg2 : 'transparent',
                color: active ? (TOPIC_COLOR[t] || COLORS.fg) : COLORS.fgFaint,
                border: `1px solid ${active ? COLORS.borderStrong : COLORS.border}`,
                borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer',
                fontFamily: FONT.mono, textTransform: 'lowercase',
              }}>{t}</button>
            );
          })}
        </div>

        {error && <div style={{ background: '#2a0f12', color: COLORS.red, padding: 10, borderRadius: 6, marginBottom: 16, fontSize: 12 }}>{error}</div>}

        <div style={{ background: COLORS.bg2, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 4 }}>
          {loading ? (
            <div style={{ padding: 24, color: COLORS.fgDim, textAlign: 'center', fontSize: 12 }}>loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 24, color: COLORS.fgFaint, textAlign: 'center', fontSize: 12 }}>no submissions</div>
          ) : rows.map(row => {
            const expanded = expandedId === row.id;
            return (
              <div key={row.id} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: '10px 12px' }}>
                <div
                  onClick={() => setExpandedId(expanded ? null : row.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                >
                  <span style={{
                    fontFamily: FONT.mono, fontSize: 10, padding: '2px 6px', borderRadius: 3,
                    background: 'rgba(255,255,255,0.04)', color: TOPIC_COLOR[row.topic] || COLORS.fgDim,
                    minWidth: 76, textAlign: 'center',
                  }}>{row.topic}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: COLORS.fg }}>{row.subject || '(no subject)'}</span>
                    {' '}
                    <span style={{ color: COLORS.fgFaint, fontSize: 11 }}>
                      — {row.name || 'anon'}{row.org ? ` · ${row.org}` : ''}
                    </span>
                  </span>
                  <span style={{ fontFamily: FONT.mono, fontSize: 10, color: COLORS.fgFaint }}>{fmtTs(row.created_at)}</span>
                  <span style={{
                    fontFamily: FONT.mono, fontSize: 10, padding: '1px 6px', borderRadius: 3,
                    color: row.status === 'new' ? COLORS.amber : row.status === 'resolved' ? COLORS.green : row.status === 'spam' ? COLORS.red : COLORS.cyan,
                    border: `1px solid ${COLORS.border}`,
                  }}>{row.status}</span>
                </div>

                {expanded && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: COLORS.bg, borderRadius: 6, fontSize: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', marginBottom: 10, fontFamily: FONT.mono, fontSize: 11, color: COLORS.fgDim }}>
                      <span>id</span><span style={{ color: COLORS.fg }}>{row.id}</span>
                      <span>email</span><span style={{ color: COLORS.fg }}>{row.email || '—'}</span>
                      <span>ip_hash</span><span>{row.ip_hash || '—'}</span>
                      <span>ua</span><span style={{ color: COLORS.fgFaint, fontSize: 10 }}>{row.user_agent || '—'}</span>
                      {row.handled_at && <>
                        <span>handled</span>
                        <span style={{ color: COLORS.fgFaint }}>{fmtTs(row.handled_at)} by {row.handled_by || '?'}</span>
                      </>}
                    </div>

                    <div style={{ whiteSpace: 'pre-wrap', padding: 10, background: COLORS.bg2, borderRadius: 4, marginBottom: 10, color: COLORS.fg }}>
                      {row.message}
                    </div>

                    {row.notes && (
                      <div style={{ padding: 8, background: '#1a1a22', borderLeft: `2px solid ${COLORS.cyan}`, marginBottom: 10, fontSize: 11, color: COLORS.fgDim, whiteSpace: 'pre-wrap' }}>
                        <div style={{ fontSize: 10, color: COLORS.fgFaint, marginBottom: 4 }}>existing notes</div>
                        {row.notes}
                      </div>
                    )}

                    <textarea
                      placeholder="add triage notes (optional)…"
                      value={notesDraft[row.id] || ''}
                      onChange={e => setNotesDraft(d => ({ ...d, [row.id]: e.target.value }))}
                      style={{
                        width: '100%', minHeight: 48, background: COLORS.bg2, color: COLORS.fg,
                        border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: 8,
                        fontFamily: FONT.body, fontSize: 12, resize: 'vertical', marginBottom: 8,
                      }}
                    />

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(['new', 'triaged', 'resolved', 'spam'] as Status[]).map(s => {
                        const isCurrent = s === row.status;
                        return (
                          <button
                            key={s}
                            disabled={busyId === row.id || isCurrent}
                            onClick={() => setRowStatus(row.id, s)}
                            style={{
                              background: isCurrent ? 'transparent' : COLORS.bg2,
                              color: isCurrent ? COLORS.fgFaint : s === 'resolved' ? COLORS.green : s === 'spam' ? COLORS.red : s === 'triaged' ? COLORS.cyan : COLORS.amber,
                              border: `1px solid ${COLORS.border}`,
                              borderRadius: 4, padding: '4px 10px', fontSize: 11,
                              cursor: isCurrent ? 'default' : 'pointer',
                              opacity: busyId === row.id ? 0.5 : 1,
                              fontFamily: FONT.body, textTransform: 'lowercase',
                            }}
                          >
                            → {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 16, fontSize: 10, color: COLORS.fgFaint, fontFamily: FONT.mono }}>
          {rows.length} shown · status={status} · topic={topic}
        </div>
      </div>
    </main>
  );
}
