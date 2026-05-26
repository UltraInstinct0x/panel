// /demo/agent — the agent-output preference demo.
// shows what panel ACTUALLY is: visitors judge real agent traces
// (skill diffs, step validity, pairwise trace comparisons) and operators
// get back RLHF-grade preference data. captcha is the wrapper, not the product.
'use client';
import { useEffect, useState, useCallback } from 'react';
import Script from 'next/script';
type Unit = {
  id: string;
  type: string;
  pool: string;
  source_agent?: string;
  prompt_context?: string;
  question?: string;
  choices?: { label: string; text: string }[];
  diff?: string;
  before?: string;
  after?: string;
  est_seconds?: number;
};

function defaultOptionsFor(unit: Unit): string[] {
  const t = (unit.type || '').toLowerCase();
  const q = (unit.question || '').toLowerCase();
  if (t.includes('step_validity') || q.includes('is this valid')) return ['valid', 'invalid', 'unsure'];
  if (t.includes('tool_call') || t.includes('reasoning_trace')) return ['good', 'mixed', 'bad', 'unsure'];
  if (t.includes('pairwise') || q.includes('which') || q.includes('pick the better')) return ['a', 'b', 'tie', 'unsure'];
  return ['1', '2', '3', '4', '5'];
}

const SITE_KEY = 'pk_demo_a';

const sx = {
  page: { background: '#08080b', color: '#e2e8f0', minHeight: '100vh', padding: '48px 32px', fontFamily: '"Inter",ui-sans-serif,system-ui,sans-serif' } as React.CSSProperties,
  wrap: { maxWidth: 880, margin: '0 auto' } as React.CSSProperties,
  h1: { font: '600 32px/1.15 "Inter",ui-sans-serif', letterSpacing: '-0.02em', margin: 0, color: '#fafafa' } as React.CSSProperties,
  lede: { font: '15px/1.55 "Inter",ui-sans-serif', color: '#a1a1aa', margin: '12px 0 28px', maxWidth: 680 } as React.CSSProperties,
  section: { borderTop: '1px solid #1f2230', padding: '28px 0' } as React.CSSProperties,
  kicker: { font: '600 12px/1.4 "JetBrains Mono",ui-monospace,monospace', color: '#67e8f9', letterSpacing: '0.08em', textTransform: 'uppercase' } as React.CSSProperties,
  card: { border: '1px solid #1f2230', background: '#0e0f15', borderRadius: 6, padding: 20, marginTop: 12 } as React.CSSProperties,
  meta: { font: '12px/1.4 "JetBrains Mono",monospace', color: '#71717a', marginBottom: 10 } as React.CSSProperties,
  q: { font: '15px/1.5 "Inter",ui-sans-serif', color: '#fafafa', margin: '6px 0 14px' } as React.CSSProperties,
  ctx: { font: '13px/1.5 "JetBrains Mono",monospace', color: '#a1a1aa', whiteSpace: 'pre-wrap' as const, background: '#06070a', padding: 12, borderRadius: 4, border: '1px solid #16181f', marginBottom: 12 } as React.CSSProperties,
  choice: { display: 'block', width: '100%', textAlign: 'left' as const, padding: '10px 14px', margin: '6px 0', background: '#11131a', color: '#e2e8f0', border: '1px solid #1f2230', borderRadius: 4, cursor: 'pointer', font: '13px/1.45 "Inter",sans-serif' } as React.CSSProperties,
  choiceHot: { background: '#163243', borderColor: '#67e8f9', color: '#fafafa' } as React.CSSProperties,
  pillRow: { display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' as const } as React.CSSProperties,
  pillBtn: { padding: '8px 14px', background: '#11131a', color: '#e2e8f0', border: '1px solid #1f2230', borderRadius: 999, cursor: 'pointer', font: '13px "Inter",sans-serif' } as React.CSSProperties,
  ok: { color: '#7eea9d', font: '13px "JetBrains Mono",monospace', marginTop: 10 } as React.CSSProperties,
  hint: { color: '#71717a', font: '12px "JetBrains Mono",monospace' } as React.CSSProperties,
  link: { color: '#67e8f9' } as React.CSSProperties,
};

function AgentUnit({ unit, onAnswer }: { unit: Unit; onAnswer: (v: string) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const submit = (v: string) => { setPicked(v); onAnswer(v); };
  useEffect(() => { setPicked(null); }, [unit.id]);

  if (unit.choices && unit.choices.length) {
    return (
      <div>
        {unit.prompt_context && <div style={sx.ctx}>{unit.prompt_context}</div>}
        <div style={sx.q}>{unit.question || 'pick the better one.'}</div>
        {unit.choices.map(c => (
          <button key={c.label} style={picked === c.label ? { ...sx.choice, ...sx.choiceHot } : sx.choice} disabled={!!picked} onClick={() => submit(c.label)}>
            <strong>{c.label}.</strong> {c.text}
          </button>
        ))}
        {picked && <div style={sx.ok}>thanks — judgment recorded as {picked}. that goes into the operator&apos;s dataset.</div>}
      </div>
    );
  }

  if (unit.diff || unit.before || unit.after) {
    return (
      <div>
        {unit.prompt_context && <div style={sx.ctx}>{unit.prompt_context}</div>}
        {unit.diff && <div style={sx.ctx}>{unit.diff}</div>}
        {unit.before && (<><div style={sx.hint}>before:</div><div style={sx.ctx}>{unit.before}</div></>)}
        {unit.after && (<><div style={sx.hint}>after:</div><div style={sx.ctx}>{unit.after}</div></>)}
        <div style={sx.q}>{unit.question || 'is this update an improvement?'}</div>
        <div style={sx.pillRow}>
          {['better', 'same', 'worse', 'unsure'].map(v => (
            <button key={v} style={picked === v ? { ...sx.pillBtn, background: '#163243', borderColor: '#67e8f9' } : sx.pillBtn} disabled={!!picked} onClick={() => submit(v)}>{v}</button>
          ))}
        </div>
        {picked && <div style={sx.ok}>judgment: <strong>{picked}</strong> — recorded.</div>}
      </div>
    );
  }

  const opts = defaultOptionsFor(unit);
  return (
    <div>
      {unit.prompt_context && <div style={sx.ctx}>{unit.prompt_context}</div>}
      <div style={sx.q}>{unit.question || 'rate this output (1–5)'}</div>
      <div style={sx.pillRow}>
        {opts.map(v => (
          <button key={v} style={picked === v ? { ...sx.pillBtn, background: '#163243', borderColor: '#67e8f9' } : sx.pillBtn} disabled={!!picked} onClick={() => submit(v)}>{v}</button>
        ))}
      </div>
      {picked && <div style={sx.ok}>recorded: {picked}. this becomes a labeled example for the source agent.</div>}
    </div>
  );
}

export default function DemoAgent() {
  const [publicUnit, setPublicUnit] = useState<Unit | null>(null);
  const [technicalUnit, setTechnicalUnit] = useState<Unit | null>(null);
  const [tErr, setTErr] = useState<string | null>(null);

  const loadPublic = useCallback(async () => {
    const rid = 'demo_' + Math.random().toString(36).slice(2, 8);
    try {
      const p = await fetch(`/api/units/next?pool=public&rater_id=${rid}&site_key=${SITE_KEY}`).then(r => r.json());
      setPublicUnit(p);
    } catch (e) {/* noop */}
  }, []);

  const loadTechnical = useCallback(async () => {
    const rid = 'demo_' + Math.random().toString(36).slice(2, 8);
    setTErr(null);
    try {
      const t = await fetch(`/api/units/next?pool=technical&rater_id=t2_${rid}&site_key=${SITE_KEY}`).then(r => r.json());
      if (t?.error) setTErr(t.error); else setTechnicalUnit(t);
    } catch (e) { setTErr(String(e)); }
  }, []);

  const loadBoth = useCallback(async () => {
    await Promise.all([loadPublic(), loadTechnical()]);
  }, [loadPublic, loadTechnical]);

  useEffect(() => { loadBoth(); }, [loadBoth]);

  useEffect(() => {
    const id = setInterval(() => {
      // @ts-ignore
      if (window.Panel) { window.Panel.autoMount(); clearInterval(id); }
    }, 200);
    return () => clearInterval(id);
  }, []);

  return (
    <>
<main style={sx.page}>
        <Script src="/v1.js" strategy="afterInteractive" />
        <div style={sx.wrap}>
          <h1 style={sx.h1}>panel — the agent-output demo</h1>
          <p style={sx.lede}>
            panel is a captcha. what makes it different: instead of clicking traffic lights to train someone&apos;s
            self-driving stack, your visitors judge <strong>your agent&apos;s actual output</strong>. skill diffs, tool-call
            steps, pairwise trace comparisons. you keep the labeled dataset. captcha-tier cost, RLHF-grade signal.
          </p>

          <section style={sx.section}>
            <div style={sx.kicker}>1 · the public pool</div>
            <p style={{ ...sx.lede, marginTop: 6 }}>
              what an anonymous visitor sees. taste calls, media judgments, simple comparisons. low friction, broad participation.
              this is what gates a signup form when you embed the widget.
            </p>
            <div style={sx.card}>
              {publicUnit ? <AgentUnit key={publicUnit.id} unit={publicUnit} onAnswer={() => {}} /> : <div style={sx.hint}>loading…</div>}
              <div style={{ ...sx.meta, marginTop: 14 }}>
                unit_id: {publicUnit?.id} · type: {publicUnit?.type} · pool: public · ~{publicUnit?.est_seconds ?? '?'}s
              </div>
            </div>
            <button style={{ ...sx.pillBtn, marginTop: 12 }} onClick={loadPublic}>load another →</button>
          </section>

          <section style={sx.section}>
            <div style={sx.kicker}>2 · the technical pool — agent outputs</div>
            <p style={{ ...sx.lede, marginTop: 6 }}>
              this is the wedge. trust-tier raters (your dogfooders, your power users, your team) judge real agent traces from
              your stack: a skill diff before/after, a tool-call step in context, a pairwise of two reply candidates. every
              judgment is a labeled example you own. no scale.ai contract, no surge invoice, no labeled-data vendor in the loop.
            </p>
            <div style={sx.card}>
              {technicalUnit ? <AgentUnit key={technicalUnit.id} unit={technicalUnit} onAnswer={() => {}} />
                : tErr ? <div style={{ ...sx.hint, color: '#f87171' }}>technical pool unavailable: {tErr}</div>
                : <div style={sx.hint}>loading…</div>}
              <div style={{ ...sx.meta, marginTop: 14 }}>
                unit_id: {technicalUnit?.id} · type: {technicalUnit?.type} · source: {technicalUnit?.source_agent ?? '—'} · pool: technical
              </div>
            </div>
            <button style={{ ...sx.pillBtn, marginTop: 12 }} onClick={loadTechnical}>load another →</button>
          </section>

          <section style={sx.section}>
            <div style={sx.kicker}>3 · in a real signup</div>
            <p style={{ ...sx.lede, marginTop: 6 }}>
              that&apos;s how a visitor sees it during signup — pill on the form, public-pool unit on click, returns a verified
              token. you keep the judgment. the operator console shows you the unit + the answer + the rater&apos;s trust tier.
            </p>
            <div style={sx.card}>
              <div data-panel-sitekey={SITE_KEY} data-panel-mode="pill" data-panel-pool="public" />
              <div style={{ ...sx.meta, marginTop: 14 }}>
                widget embed: <code>&lt;div data-panel-sitekey=&quot;{SITE_KEY}&quot; data-panel-mode=&quot;pill&quot; /&gt;</code>
              </div>
            </div>
          </section>

          <section style={sx.section}>
            <div style={sx.kicker}>further</div>
            <ul style={{ font: '14px/1.7 "Inter",sans-serif', color: '#a1a1aa', paddingLeft: 18 }}>
              <li><a style={sx.link} href="/demo/c0-c3">tier ladder (c0→c3) demo</a></li>
              <li><a style={sx.link} href="/demo/gate">full signup-gate demo</a></li>
              <li><a style={sx.link} href="/review/u_skill_001">live skill-review verdict (rater-as-reviewer)</a></li>
              <li><a style={sx.link} href="/how-it-works">how it works</a> · <a style={sx.link} href="/docs">docs</a></li>
              <li><a style={sx.link} href="/privacy">privacy</a> · <a style={sx.link} href="/legal/terms">terms</a> · <a style={sx.link} href="/legal/dpa">DPA</a></li>
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}