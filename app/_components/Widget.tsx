'use client';
import { useEffect, useState, useCallback, useRef } from 'react';

type Unit = {
  id: string;
  type: 'pairwise_trace' | 'step_validity' | 'skill_diff' | 'hallucination_flag' | 'taste_rank' | 'sarcasm_detect' | 'ai_vs_real' | 'dub_sync';
  pool: 'public' | 'technical';
  source_agent: string;
  prompt_context: string;
  question: string;
  choices?: { label: string; text: string }[];
  binary?: { yes: string; no: string };
  diff?: string;
  video_url?: string;
  audio_offset_ms?: number;
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

type WidgetProps = {
  onSolved?: (result: { trust: number; earned_cents: number; token: string }) => void;
  siteKey?: string;
  pool?: 'public' | 'technical';
};

const ENGAGEMENT_MIN_MS = 2500;

export default function Widget({ onSolved, siteKey = 'pk_demo_a', pool = 'public' }: WidgetProps) {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [shownAt, setShownAt] = useState<number>(0);
  const [solved, setSolved] = useState<{ trust: number; trust_delta: number; earned_cents: number; agreed: boolean | null; honeypot_failed: boolean; behavioral_score: number; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipCount, setSkipCount] = useState(0);
  const [now, setNow] = useState<number>(0);

  // behavioral collector — D13.1 floor.
  const behavioralRef = useRef({
    samples: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    totalDist: 0,
    speedAccum: 0,
    speedSamples: 0,
    dirChanges: 0,
    lastDx: 0,
    lastDy: 0,
    focusEvents: 0,
  });

  const resetBehavioral = useCallback(() => {
    behavioralRef.current = {
      samples: 0, lastX: 0, lastY: 0, lastT: 0,
      totalDist: 0, speedAccum: 0, speedSamples: 0,
      dirChanges: 0, lastDx: 0, lastDy: 0, focusEvents: 0,
    };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const b = behavioralRef.current;
      const t = performance.now();
      if (b.samples > 0) {
        const dx = e.clientX - b.lastX;
        const dy = e.clientY - b.lastY;
        const dt = Math.max(1, t - b.lastT);
        const d = Math.hypot(dx, dy);
        b.totalDist += d;
        b.speedAccum += d / dt;
        b.speedSamples += 1;
        if ((dx * b.lastDx + dy * b.lastDy) < 0) b.dirChanges += 1;
        b.lastDx = dx; b.lastDy = dy;
      }
      b.lastX = e.clientX; b.lastY = e.clientY; b.lastT = t; b.samples += 1;
    };
    const onFocus = () => { behavioralRef.current.focusEvents += 1; };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('focusin', onFocus);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('focusin', onFocus);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSolved(null);
    resetBehavioral();
    try {
      const rid = getRaterId();
      const r = await fetch(`/api/units/next?rater_id=${rid}&pool=${pool}`, {
        headers: { 'X-Panel-Site-Key': siteKey },
      });
      if (!r.ok) throw new Error(`upstream ${r.status}`);
      const data = await r.json();
      setUnit(data);
      setShownAt(Date.now());
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [siteKey, pool, resetBehavioral]);

  useEffect(() => { load(); }, [load]);

  // tick for the engagement-window countdown UI
  useEffect(() => {
    if (!shownAt || solved) return;
    const i = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(i);
  }, [shownAt, solved]);

  const submit = async (choice: string) => {
    if (!unit) return;
    const rid = getRaterId();
    const latency_ms = Date.now() - shownAt;
    const b = behavioralRef.current;
    const behavioral = {
      mouse_path_summary: {
        sample_count: b.samples,
        total_distance_px: Math.round(b.totalDist),
        avg_speed_px_ms: b.speedSamples ? +(b.speedAccum / b.speedSamples).toFixed(4) : 0,
        direction_changes: b.dirChanges,
      },
      dwell_ms: latency_ms,
      focus_events: b.focusEvents,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      ua: navigator.userAgent.slice(0, 200),
    };
    try {
      const r = await fetch('/api/judgments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Panel-Site-Key': siteKey },
        body: JSON.stringify({ unit_id: unit.id, rater_id: rid, choice, latency_ms, confidence: 0.8, behavioral }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'submit failed');
      const s = {
        trust: data.trust,
        trust_delta: data.trust_delta,
        earned_cents: data.earned_cents,
        agreed: data._demo_agreed_with_gold,
        honeypot_failed: !!data._demo_honeypot_failed,
        behavioral_score: data._demo_behavioral_score ?? 0,
        token: data.token,
      };
      setSolved(s);
      if (onSolved) onSolved({ trust: s.trust, earned_cents: s.earned_cents, token: s.token });
      // emit to parent frame for iframe SDK use
      if (typeof window !== 'undefined' && window.parent !== window) {
        window.parent.postMessage({ type: 'panel:solved', token: s.token, trust: s.trust }, '*');
      }
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
          <span className={solved.honeypot_failed ? 'badge badge-danger' : 'badge badge-ok'}>
            {solved.honeypot_failed ? '⚠ flagged' : '✓ human'}
          </span>
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
              <div className="muted" style={{ fontSize: 11 }}>behavioral</div>
              <div style={{ fontSize: 18 }}>{(solved.behavioral_score * 100).toFixed(0)}%</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 11 }}>pool match</div>
              <div style={{ fontSize: 18 }}>{solved.agreed === null ? '—' : solved.agreed ? '✓' : '✗'}</div>
            </div>
          </div>
          <div className="faint" style={{ marginTop: 8, fontSize: 10, wordBreak: 'break-all' }}>token: {solved.token}</div>
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-ghost" onClick={load}>judge another →</button>
          </div>
        </div>
      </div>
    );
  }

  const elapsed = now ? now - shownAt : 0;
  const tooFast = elapsed < ENGAGEMENT_MIN_MS;
  const remaining = Math.max(0, ENGAGEMENT_MIN_MS - elapsed);

  return (
    <div className="widget">
      <div className="widget-header">
        <span className="widget-title">▰ panel · {unit.type.replace(/_/g, ' ')} · {unit.pool}</span>
        <button className="widget-skip" onClick={skip} title="skip — no penalty">skip ↷</button>
      </div>
      <div className="unit-prompt"><span className="faint">via</span> {unit.source_agent}</div>
      <div className="unit-prompt"><pre style={{ background: 'transparent', border: 0, padding: 0, margin: 0, color: 'var(--fg-dim)' }}>{unit.prompt_context}</pre></div>
      <div className="unit-question">{unit.question}</div>

      {unit.diff && (
        <pre style={{ marginBottom: 12 }}>{renderDiff(unit.diff)}</pre>
      )}

      {unit.type === 'dub_sync' && unit.video_url && (
        <div style={{ marginBottom: 12 }}>
          <video
            src={unit.video_url}
            controls
            playsInline
            style={{ width: '100%', maxHeight: 240, background: '#000' }}
          />
          <div className="faint" style={{ fontSize: 10, marginTop: 4 }}>
            synthetic audio offset marker in metadata: {unit.audio_offset_ms} ms (PoC — no real A/V manipulation)
          </div>
        </div>
      )}

      {unit.choices && unit.choices.map(c => (
        <button key={c.label} className="choice" disabled={tooFast} onClick={() => submit(c.label)}>
          <span className="choice-label">{c.label}</span> {c.text}
        </button>
      ))}

      {unit.binary && (
        <>
          <button className="choice" disabled={tooFast} onClick={() => submit('yes')}>
            <span className="choice-label" style={{ color: 'var(--ok)' }}>✓</span> {unit.binary.yes}
          </button>
          <button className="choice" disabled={tooFast} onClick={() => submit('no')}>
            <span className="choice-label" style={{ color: 'var(--danger)' }}>✗</span> {unit.binary.no}
          </button>
        </>
      )}

      <div className="row-between" style={{ marginTop: 8 }}>
        <span className="faint" style={{ fontSize: 10 }}>
          ~{unit.est_seconds}s · {skipCount} skipped
          {tooFast && <> · engagement window: {(remaining / 1000).toFixed(1)}s</>}
        </span>
        <span className="faint" style={{ fontSize: 10 }}>scrubbed via panel scrubber-proxy</span>
      </div>
    </div>
  );
}
