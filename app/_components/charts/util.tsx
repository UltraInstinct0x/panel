// shared chart helpers — Linear-style dark surfaces, recharts-based.
'use client';
import React from 'react';

/** deterministic HSL color from a unit-type name. consistent across charts + chips. */
export function typeColor(t: string): string {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  // mid-saturation, cool-ish luminance so it sits on a dark bg without screaming
  return `hsl(${hue} 65% 62%)`;
}

export const fmt = {
  int: (n: number) => n.toLocaleString('en-US'),
  pct1: (n: number) => `${n.toFixed(1)}%`,
  ms: (n: number) => `${Math.round(n).toLocaleString('en-US')}ms`,
  /** cents per unit, e.g. 1.5¢ → "$0.015ea" */
  centsEa: (cents: number) => `$${(cents / 100).toFixed(3)}ea`,
  dollars: (cents: number) => `$${(cents / 100).toFixed(2)}`,
  dateShort: (iso: string) => {
    const d = new Date(iso + 'T00:00:00Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  },
};

export function ChartTooltipContent({ active, payload, label, valueFormatter }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="ch-tooltip">
      {label !== undefined && <div className="ch-tooltip-label">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="ch-tooltip-row">
          <span className="ch-tooltip-dot" style={{ background: p.color || p.fill }} />
          <span className="ch-tooltip-name">{p.name}</span>
          <span className="ch-tooltip-val">
            {valueFormatter ? valueFormatter(p.value, p) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}
