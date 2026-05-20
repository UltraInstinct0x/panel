'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Sarcasm from './units/Sarcasm';
import TasteRank from './units/TasteRank';
import AiVsReal from './units/AiVsReal';
import DubSync from './units/DubSync';
import DragRank from './units/DragRank';
import SpanHighlight from './units/SpanHighlight';
import Default from './units/Default';
import type { RendererUnit } from './units/types';

type Unit = RendererUnit;

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

type WidgetProps = {
  onSolved?: (result: { trust: number; earned_cents: number; token: string }) => void;
  siteKey?: string;
  pool?: 'public' | 'technical';
};

const ENGAGEMENT_MIN_MS = 2500;
const MOUSE_THROTTLE_MS = 50;
const FOCUS_POLL_MS = 250;

export default function Widget({ onSolved, siteKey = 'pk_demo_a', pool = 'public' }: WidgetProps) {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [shownAt, setShownAt] = useState<number>(0);
  const [solved, setSolved] = useState<{ trust: number; trust_delta: number; earned_cents: number; agreed: boolean | null; honeypot_failed: boolean; behavioral_score: number; token: string; too_fast: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipCount, setSkipCount] = useState(0);
  const [now, setNow] = useState<number>(0);

  // per-type local state
  const [order, setOrder] = useState<string[]>([]);
  const [spanSel, setSpanSel] = useState<{ start: number; end: number } | null>(null);

  // ---- behavioral collector — D13 layer 1, REAL signals only ----
  const behavioralRef = useRef({
    samples: 0,
    lastX: 0, lastY: 0, lastT: 0, lastSampleT: 0,
    totalDist: 0,
    speedAccum: 0, speedSamples: 0,
    dirChanges: 0,
    lastDx: 0, lastDy: 0,
    focusEvents: 0,
    lastFocusState: typeof document !== 'undefined' ? document.hasFocus() : true,
    mountedAt: typeof performance !== 'undefined' ? performance.now() : 0,
  });

  const resetBehavioral = useCallback(() => {
    behavioralRef.current = {
      samples: 0, lastX: 0, lastY: 0, lastT: 0, lastSampleT: 0,
      totalDist: 0, speedAccum: 0, speedSamples: 0,
      dirChanges: 0, lastDx: 0, lastDy: 0,
      focusEvents: 0,
      lastFocusState: typeof document !== 'undefined' ? document.hasFocus() : true,
      mountedAt: typeof performance !== 'undefined' ? performance.now() : 0,
    };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const b = behavioralRef.current;
      const t = performance.now();
      if (t - b.lastSampleT < MOUSE_THROTTLE_MS) return;
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
      b.lastX = e.clientX; b.lastY = e.clientY; b.lastT = t; b.lastSampleT = t; b.samples += 1;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    const i = setInterval(() => {
      if (typeof document === 'undefined') return;
      const cur = document.hasFocus();
      const b = behavioralRef.current;
      if (cur !== b.lastFocusState) {
        b.focusEvents += 1;
        b.lastFocusState = cur;
      }
    }, FOCUS_POLL_MS);
    return () => clearInterval(i);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSolved(null);
    setOrder([]);
    setSpanSel(null);
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
      if (data.type === 'drag_to_rank' && Array.isArray(data.items)) {
        const labels = data.items.map((i: any) => i.label);
        for (let i = labels.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [labels[i], labels[j]] = [labels[j], labels[i]];
        }
        setOrder(labels);
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [siteKey, pool, resetBehavioral]);

  useEffect(() => { load(); }, [load]);

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
    const dwell_ms = Math.round(performance.now() - b.mountedAt);
    const too_fast = latency_ms < ENGAGEMENT_MIN_MS;
    const behavioral = {
      mouse_path_summary: {
        sample_count: b.samples,
        total_distance_px: Math.round(b.totalDist),
        avg_speed_px_ms: b.speedSamples ? +(b.speedAccum / b.speedSamples).toFixed(4) : 0,
        direction_changes: b.dirChanges,
      },
      dwell_ms,
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
        too_fast,
      };
      setSolved(s);
      if (onSolved) onSolved({ trust: s.trust, earned_cents: s.earned_cents, token: s.token });
      if (typeof window !== 'undefined' && window.parent !== window) {
        window.parent.postMessage({ type: 'panel:solved', token: s.token, trust: s.trust }, '*');
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  };

  const skip = () => { setSkipCount(s => s + 1); load(); };

  // dwell timer for header (MM:SSs)
  const dwellStr = (() => {
    if (!shownAt) return '00:000';
    const ms = (now || Date.now()) - shownAt;
    const s = Math.floor(ms / 1000);
    const frac = Math.floor((ms % 1000));
    return `${String(s).padStart(2, '0')}:${String(frac).padStart(3, '0')}`;
  })();

  if (loading) {
    return (
      <div className="w2">
        <Header dwell="--:---" onSkip={undefined} />
        <div className="w2-loading">▰ loading unit…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w2">
        <Header dwell={dwellStr} onSkip={undefined} />
        <div className="w2-fail">
          <div className="w2-fail-glyph" aria-hidden>!</div>
          <div className="w2-fail-title">something went wrong</div>
          <div className="w2-fail-msg">we couldn’t reach the unit service. give it another try.</div>
          <button className="u-submit" onClick={() => { setError(null); load(); }}>try again</button>
        </div>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="w2">
        <Header dwell={dwellStr} onSkip={undefined} />
        <div className="w2-loading">no unit.</div>
      </div>
    );
  }

  if (solved) {
    // failure cases (friendly, no internal flags)
    if (solved.honeypot_failed) {
      return (
        <div className="w2">
          <Header dwell={dwellStr} onSkip={undefined} />
          <div className="w2-fail">
            <div className="w2-fail-glyph w2-fail-glyph--warn" aria-hidden>!</div>
            <div className="w2-fail-title">that wasn’t quite it</div>
            <div className="w2-fail-msg">that question had a known answer. try another to keep going.</div>
            <button className="u-submit" onClick={load}>try another</button>
          </div>
        </div>
      );
    }
    if (solved.too_fast) {
      return (
        <div className="w2">
          <Header dwell={dwellStr} onSkip={undefined} />
          <div className="w2-fail">
            <div className="w2-fail-glyph w2-fail-glyph--warn" aria-hidden>⏱</div>
            <div className="w2-fail-title">slow down a second</div>
            <div className="w2-fail-msg">give it a moment of real attention. another question coming up.</div>
            <button className="u-submit" onClick={load}>next question</button>
          </div>
        </div>
      );
    }
    return (
      <div className="w2">
        <Header dwell={dwellStr} onSkip={undefined} />
        <div className="w2-ok">
          <div className="w2-ok-check" aria-hidden>
            <svg width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="20" fill="none" stroke="var(--ok)" strokeWidth="2" opacity="0.4" />
              <path d="M13 23 l6 6 l12 -14" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="w2-ok-title">verified</div>
          <div className="w2-ok-meta">
            <span>dwell {dwellStr}</span>
            <span>·</span>
            <span>trust {(solved.trust * 100).toFixed(1)}%</span>
            <span className={solved.trust_delta >= 0 ? 'diff-add' : 'diff-del'}>
              ({solved.trust_delta >= 0 ? '+' : ''}{(solved.trust_delta * 100).toFixed(2)}%)
            </span>
          </div>
          <div className="w2-ok-meta">earned ${(solved.earned_cents / 100).toFixed(2)} · token issued</div>
          <div className="w2-ok-token">{solved.token.slice(0, 32)}…</div>
          <button className="u-submit" onClick={load}>judge another →</button>
        </div>
      </div>
    );
  }

  const elapsed = now ? now - shownAt : 0;
  const tooFast = elapsed < ENGAGEMENT_MIN_MS;

  // dispatch
  let renderer: React.ReactNode;
  switch (unit.type) {
    case 'sarcasm_detect':
      renderer = <Sarcasm unit={unit} onAnswer={submit} disabled={tooFast} />;
      break;
    case 'taste_rank':
      renderer = <TasteRank unit={unit} onAnswer={submit} disabled={tooFast} />;
      break;
    case 'ai_vs_real':
      renderer = <AiVsReal unit={unit} onAnswer={submit} disabled={tooFast} />;
      break;
    case 'dub_sync':
      renderer = <DubSync unit={unit} onAnswer={submit} disabled={tooFast} />;
      break;
    case 'drag_to_rank':
      renderer = <DragRank unit={unit} onAnswer={submit} disabled={tooFast} order={order} setOrder={setOrder} />;
      break;
    case 'span_highlight':
      renderer = <SpanHighlight unit={unit} onAnswer={submit} disabled={tooFast} selection={spanSel} setSelection={setSpanSel} />;
      break;
    default:
      renderer = <Default unit={unit} onAnswer={submit} disabled={tooFast} />;
  }

  return (
    <div className="w2">
      <Header dwell={dwellStr} onSkip={skip} />
      <div className="w2-source">via <span className="w2-source-name">{unit.source_agent}</span></div>
      <div className="w2-prompt">{unit.prompt_context}</div>
      <div className="w2-question">{unit.question}</div>

      <div className="w2-body">{renderer}</div>

      <div className="w2-foot">
        <span>~{unit.est_seconds}s expected · {skipCount} skipped</span>
        <span>scrubbed via panel proxy</span>
      </div>
    </div>
  );
}

function Header({ dwell, onSkip }: { dwell: string; onSkip?: () => void }) {
  return (
    <div className="w2-header">
      <span className="w2-brand">panel · captcha</span>
      <span className="w2-dwell" aria-label="time on this question">{dwell}</span>
      {onSkip && <button className="w2-skip" onClick={onSkip} title="skip — no penalty">skip ↷</button>}
    </div>
  );
}
