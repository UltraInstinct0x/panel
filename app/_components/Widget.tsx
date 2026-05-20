'use client';
import { useEffect, useState, useCallback } from 'react';

type Unit = {
  id: string;
  type: 'pairwise_trace' | 'step_validity' | 'skill_diff' | 'hallucination_flag' | 'taste_rank';
  source_agent: string;
  prompt_context: string;
  question: string;
  choices?: { label: string; text: string }[];
  binary?: { yes: string; no: string };
  diff?: string;
  est_seconds: number;
};

const RATER_KEY = 'panel_rater_id';
function getRaterId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = window.localStorage.getItem(RATER_KEY);
  if (!id) {
    id = 'r_' + Math.random().toString(36).slice(2, 12);
    window.localStorage.setItem(RATER_KEY, id);
  }
  return id;
}

function renderDiff(diff: string) {
  return diff.split('\n').map((line, i) => {
    const cls = line.startsWith('+') ? 'diff-add' : line.startsWith('-') ? 'diff-del' : 'diff-ctx';
    return <div key={i} className={cls}>{line || '\u00a0'}</div>;
  });
}

export default function Widget({ onSolved }: { onSolved?: (result: { trust: number; earned_cents: number }) => void }) {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [shownAt, setShownAt] = useState<number>(0);
  const [solved, setSolved] = useState<{ trust: number; trust_delta: number; earned_cents: number; agreed: boolean | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipCount, setSkipCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSolved(null);
    try {
      const rid = getRaterId();
      const r = await fetch(`/api/units/next?rater_id=${rid}`);
      if (!r.ok) throw new Error(`upstream ${r.status}`);
      const data = await r.json();
      setUnit(data);
      setShownAt(Date.now());
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (choice: string) => {
    if (!unit) return;
    const rid = getRaterId();
    const latency_ms = Date.now() - shownAt;
    try {
      const r = await fetch('/api/judgments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: unit.id, rater_id: rid, choice, latency_ms, confidence: 0.8 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'submit failed');
      setSolved({
        trust: data.trust,
        trust_delta: data.trust_delta,
        earned_cents: data.earned_cents,
        agreed: data._demo_agreed_with_gold,
      });
      if (onSolved) onSolved({ trust: data.trust, earned_cents: data.earned_cents });
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  };

  const skip = () => {
    setSkipCount(s => s + 1);
    load();
  };

  if (loading) return <div className="widget"><div className="muted">▰ loading unit…</div></div>;
  if (error) return <div className="widget"><div className="badge badge-danger">error</div> <span className="muted">{error}</span></div>;
  if (!unit) return <div className="widget"><div className="muted">no unit.</div></div>;

  if (solved) {
    return (
      <div className="widget">
        <div className="widget-header">
          <span className="widget-title">▰ panel · verified</span>
          <span className="badge badge-ok">✓ human</span>
        </div>
        <div style={{ padding: '8px 0' }}>
          <div className="row-between">
            <div>
              <div className="muted" style={{ fontSize: 11 }}>trust</div>
              <div style={{ fontSize: 18 }}>{(solved.trust * 100).toFixed(1)}%
                <span className={solved.trust_delta >= 0 ? 'diff-add' : 'diff-del'} style={{ fontSize: 11, marginLeft: 6 }}>
                  {solved.trust_delta >= 0 ? '+' : ''}{(solved.trust_delta * 100).toFixed(2)}%
                </span>
              </div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 11 }}>earned</div>
              <div style={{ fontSize: 18 }}>${(solved.earned_cents / 100).toFixed(2)}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 11 }}>gold match</div>
              <div style={{ fontSize: 18 }}>{solved.agreed === null ? '—' : solved.agreed ? '✓' : '✗'}</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-ghost" onClick={load}>judge another →</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="widget">
      <div className="widget-header">
        <span className="widget-title">▰ panel · {unit.type.replace('_', ' ')}</span>
        <button className="widget-skip" onClick={skip} title="skip — no penalty">skip ↷</button>
      </div>
      <div className="unit-prompt"><span className="faint">via</span> {unit.source_agent}</div>
      <div className="unit-prompt"><pre style={{ background: 'transparent', border: 0, padding: 0, margin: 0, color: 'var(--fg-dim)' }}>{unit.prompt_context}</pre></div>
      <div className="unit-question">{unit.question}</div>

      {unit.diff && (
        <pre style={{ marginBottom: 12 }}>{renderDiff(unit.diff)}</pre>
      )}

      {unit.choices && unit.choices.map(c => (
        <button key={c.label} className="choice" onClick={() => submit(c.label)}>
          <span className="choice-label">{c.label}</span> {c.text}
        </button>
      ))}

      {unit.binary && (
        <>
          <button className="choice" onClick={() => submit('yes')}>
            <span className="choice-label" style={{ color: 'var(--ok)' }}>✓</span> {unit.binary.yes}
          </button>
          <button className="choice" onClick={() => submit('no')}>
            <span className="choice-label" style={{ color: 'var(--danger) ' }}>✗</span> {unit.binary.no}
          </button>
        </>
      )}

      <div className="row-between" style={{ marginTop: 8 }}>
        <span className="faint" style={{ fontSize: 10 }}>~{unit.est_seconds}s · {skipCount} skipped</span>
        <span className="faint" style={{ fontSize: 10 }}>scrubbed via panel scrubber-proxy</span>
      </div>
    </div>
  );
}
