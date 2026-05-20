'use client';
import React from 'react';
import { typeColor } from './util';

export function TypeChip({ type, count, muted }: { type: string; count?: number; muted?: boolean }) {
  const c = typeColor(type);
  return (
    <span className="type-chip" style={{
      borderColor: muted ? 'rgba(255,255,255,0.08)' : c,
      color: muted ? 'var(--fg-dim)' : c,
    }}>
      <span className="type-chip-dot" style={{ background: c }} />
      <span className="type-chip-label">{type}</span>
      {count !== undefined && <span className="type-chip-count">{count.toLocaleString('en-US')}</span>}
    </span>
  );
}

export function StatCard({
  label, value, sub, delta,
}: { label: string; value: React.ReactNode; sub?: React.ReactNode; delta?: { dir: 'up' | 'down' | 'flat'; text: string } }) {
  return (
    <div className="ch-stat">
      <div className="ch-stat-label">{label}</div>
      <div className="ch-stat-value">{value}</div>
      <div className="ch-stat-sub">
        {delta && (
          <span className={`ch-delta ch-delta-${delta.dir}`}>
            {delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '·'} {delta.text}
          </span>
        )}
        {sub}
      </div>
    </div>
  );
}

export function ChartCard({
  title, subtitle, right, height = 280, children,
}: { title: string; subtitle?: string; right?: React.ReactNode; height?: number; children: React.ReactNode }) {
  return (
    <div className="ch-card">
      <div className="ch-card-head">
        <div>
          <div className="ch-card-title">{title}</div>
          {subtitle && <div className="ch-card-sub">{subtitle}</div>}
        </div>
        {right && <div className="ch-card-right">{right}</div>}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="ch-empty">
      <div className="ch-empty-glyph">▱ ▱ ▱</div>
      <div className="ch-empty-msg">{message}</div>
    </div>
  );
}

export function PulseSkeleton({ height = 280 }: { height?: number }) {
  return <div className="ch-skel" style={{ height }} />;
}
