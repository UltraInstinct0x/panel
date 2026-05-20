'use client';
// WS-Q: tier-policy editor — client component, talks to PUT /api/admin/operators/[key]/policy.
import { useState } from 'react';
import { COLORS, FONT, Chip } from './_ui';

type Policy = {
  t_c0_max: number;
  t_c1_max: number;
  t_c2_max: number;
  min_trust: number;
  auto_c0: boolean;
  escalate_on_fail: boolean;
};

const MAX_TIERS = ['C1', 'C2', 'C3'] as const;

export function PolicyEditor(props: { siteKey: string; initial: Policy; initialMaxTier: 'C1' | 'C2' | 'C3' }) {
  const [pol, setPol] = useState<Policy>(props.initial);
  const [maxTier, setMaxTier] = useState<'C1' | 'C2' | 'C3'>(props.initialMaxTier);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  // map max_tier to upper thresholds (force higher tiers off by collapsing bounds)
  function effective(p: Policy, mt: 'C1' | 'C2' | 'C3'): Policy {
    const out = { ...p };
    if (mt === 'C1') { out.t_c1_max = 1; out.t_c2_max = 1; }
    else if (mt === 'C2') { out.t_c2_max = 1; }
    return out;
  }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const body = { policy: effective(pol, maxTier) };
      const r = await fetch(`/api/admin/operators/${encodeURIComponent(props.siteKey)}/policy`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `http ${r.status}`);
      setMsg({ tone: 'ok', text: 'saved · audit logged' });
    } catch (e: any) {
      setMsg({ tone: 'err', text: String(e.message || e) });
    } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Slider label="min_trust" value={pol.min_trust} onChange={v => setPol({ ...pol, min_trust: v })} />
      <Slider label="t_c0_max" value={pol.t_c0_max} onChange={v => setPol({ ...pol, t_c0_max: v })} />
      <Slider label="t_c1_max" value={pol.t_c1_max} onChange={v => setPol({ ...pol, t_c1_max: v })} />
      <Slider label="t_c2_max" value={pol.t_c2_max} onChange={v => setPol({ ...pol, t_c2_max: v })} />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <ToggleChip label="auto_c0" on={pol.auto_c0} onClick={() => setPol({ ...pol, auto_c0: !pol.auto_c0 })} />
        <ToggleChip label="escalate_on_fail" on={pol.escalate_on_fail} onClick={() => setPol({ ...pol, escalate_on_fail: !pol.escalate_on_fail })} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: COLORS.fgFaint, letterSpacing: 0.4, textTransform: 'uppercase' }}>max_tier</span>
          <select
            value={maxTier}
            onChange={e => setMaxTier(e.target.value as 'C1' | 'C2' | 'C3')}
            style={{
              background: '#000',
              color: COLORS.cyan,
              border: `1px solid ${COLORS.border}`,
              padding: '4px 8px',
              fontFamily: FONT.mono,
              fontSize: 12,
              borderRadius: 4,
            }}
          >
            {MAX_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          onClick={save}
          disabled={busy}
          style={{
            background: COLORS.cyan,
            color: '#000',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 500,
            fontFamily: FONT.body,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >{busy ? 'saving…' : 'save policy'}</button>
        {msg && <Chip tone={msg.tone === 'ok' ? 'green' : 'red'}>{msg.text}</Chip>}
      </div>
    </div>
  );
}

function Slider(props: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: COLORS.fgFaint, letterSpacing: 0.4, textTransform: 'uppercase', fontFamily: FONT.mono }}>{props.label}</span>
        <span style={{ fontFamily: FONT.mono, fontSize: 12, color: COLORS.cyan }}>{props.value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={props.value}
        onChange={e => props.onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: COLORS.cyan }}
      />
    </div>
  );
}

function ToggleChip(props: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        borderRadius: 4,
        fontSize: 11,
        fontFamily: FONT.mono,
        background: props.on ? 'rgba(103,232,249,0.08)' : 'rgba(255,255,255,0.02)',
        color: props.on ? COLORS.cyan : COLORS.fgDim,
        border: `1px solid ${props.on ? 'rgba(103,232,249,0.35)' : COLORS.border}`,
        cursor: 'pointer',
      }}
    >
      <span style={{
        width: 6, height: 6, borderRadius: 999,
        background: props.on ? COLORS.cyan : COLORS.fgFaint,
      }} />
      {props.label} · {props.on ? 'on' : 'off'}
    </button>
  );
}

export function ScrubberToggle(props: { siteKey: string; initial: boolean; label: string | null }) {
  const [on, setOn] = useState(props.initial);
  const [label, setLabel] = useState(props.label ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  async function save(nextOn: boolean, nextLabel: string) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/admin/operators/${encodeURIComponent(props.siteKey)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scrubber_required: nextOn, label: nextLabel }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `http ${r.status}`);
      setMsg({ tone: 'ok', text: 'saved · audit logged' });
    } catch (e: any) {
      setMsg({ tone: 'err', text: String(e.message || e) });
    } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <ToggleChip label="scrubber_required" on={on} onClick={() => { const n = !on; setOn(n); save(n, label); }} />
        <span style={{ color: COLORS.fgDim, fontSize: 11 }}>
          off = carve-out · scrubber attestation header is NOT required on ingest
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: COLORS.fgFaint, letterSpacing: 0.4, textTransform: 'uppercase' }}>label</span>
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          onBlur={() => save(on, label)}
          placeholder="(none)"
          style={{
            background: '#000',
            color: COLORS.fg,
            border: `1px solid ${COLORS.border}`,
            padding: '4px 8px',
            fontFamily: FONT.body,
            fontSize: 12,
            borderRadius: 4,
            minWidth: 220,
          }}
        />
        {busy && <span style={{ fontSize: 11, color: COLORS.fgDim }}>saving…</span>}
        {msg && <Chip tone={msg.tone === 'ok' ? 'green' : 'red'}>{msg.text}</Chip>}
      </div>
    </div>
  );
}
