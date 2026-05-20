'use client';
import { RendererProps, hashId } from './types';

const HANDLES = [
  'junior_dev_42', 'pm_with_opinions', 'staff_eng_emeritus', 'devrel_jenna',
  'midnight_committer', 'former_sre', 'tech_lead_001', 'startup_cto',
  'reply_guy_99', 'release_manager', 'sleepy_dba', 'cynical_qa',
];
const COLORS = ['#67e8f9', '#a78bfa', '#f59e0b', '#4ade80', '#f87171', '#fb923c', '#34d399', '#60a5fa'];

function initials(handle: string) {
  const parts = handle.split(/[_\d]/).filter(Boolean);
  return ((parts[0]?.[0] || handle[0]) + (parts[1]?.[0] || handle[1] || '')).toUpperCase();
}

function fauxTime(seed: number) {
  // seed may be a large uint32 — coerce to non-negative
  const s = Math.abs(seed | 0) >>> 0;
  const h = (s % 12) + 1;
  const m = String(s % 60).padStart(2, '0');
  const ap = s % 2 === 0 ? 'AM' : 'PM';
  return `${h}:${m} ${ap}`;
}

export default function Sarcasm({ unit, onAnswer, disabled }: RendererProps) {
  const seed = hashId(unit.id);
  const handle = HANDLES[seed % HANDLES.length];
  const color = COLORS[((seed >>> 4) % COLORS.length)];
  const time = fauxTime(seed >>> 8);
  const body = unit.prompt_context.replace(/^[^"]*"|"[^"]*$/g, (s) => s).replace(/^.*?[:"]\s*/, '').replace(/"$/, '');
  const text = /["“”]/.test(unit.prompt_context) ? body : unit.prompt_context;

  return (
    <div className="u-sarc">
      <div className="u-sarc-msg">
        <div className="u-sarc-avatar" style={{ background: color }}>{initials(handle)}</div>
        <div className="u-sarc-body">
          <div className="u-sarc-meta">
            <span className="u-sarc-handle">@{handle}</span>
            <span className="u-sarc-time">{time}</span>
          </div>
          <div className="u-sarc-bubble">{text}</div>
        </div>
      </div>

      <div className="u-pill-row">
        <button className="u-pill u-pill-bad" disabled={disabled} onClick={() => onAnswer('yes')}>
          sarcastic
        </button>
        <button className="u-pill u-pill-ok" disabled={disabled} onClick={() => onAnswer('no')}>
          sincere
        </button>
      </div>
    </div>
  );
}
