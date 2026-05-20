// WS-Q: shared dark-Linear aesthetic primitives for /admin/operators/*.
// kept inline-style (no css module dep) to mirror existing admin pages.
import React from 'react';

export const COLORS = {
  bg: '#08080b',
  bg2: '#0f0f14',
  fg: '#e8e8ec',
  fgDim: '#9a9aa3',
  fgFaint: '#5b5b65',
  border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.12)',
  cyan: '#67e8f9',
  green: '#86efac',
  red: '#fca5a5',
  amber: '#fcd34d',
};

export const FONT = {
  body: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
  mono: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
};

export function Shell(props: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main style={{
      background: COLORS.bg,
      color: COLORS.fg,
      minHeight: '100vh',
      fontFamily: FONT.body,
      fontSize: 13,
      lineHeight: 1.5,
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 28px' }}>
        <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.fgFaint, letterSpacing: 0.4, textTransform: 'uppercase' }}>panel · admin</div>
            <h1 style={{ fontSize: 18, fontWeight: 500, margin: '4px 0 2px', letterSpacing: -0.2 }}>{props.title}</h1>
            {props.subtitle && <div style={{ color: COLORS.fgDim, fontSize: 12 }}>{props.subtitle}</div>}
          </div>
          {props.right}
        </header>
        {props.children}
      </div>
    </main>
  );
}

export function Chip(props: { children: React.ReactNode; tone?: 'cyan' | 'red' | 'amber' | 'green' | 'mute'; mono?: boolean }) {
  const tone = props.tone ?? 'mute';
  const c =
    tone === 'cyan' ? COLORS.cyan :
    tone === 'red' ? COLORS.red :
    tone === 'amber' ? COLORS.amber :
    tone === 'green' ? COLORS.green :
    COLORS.fgDim;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontFamily: props.mono ? FONT.mono : FONT.body,
      color: c,
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${COLORS.border}`,
      letterSpacing: 0.2,
    }}>{props.children}</span>
  );
}

export function Card(props: { title?: string; children: React.ReactNode; pad?: number }) {
  return (
    <section style={{
      background: COLORS.bg2,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 6,
      padding: props.pad ?? 16,
      marginBottom: 16,
    }}>
      {props.title && (
        <h2 style={{ fontSize: 11, color: COLORS.fgFaint, letterSpacing: 0.5, textTransform: 'uppercase', margin: '0 0 12px', fontWeight: 500 }}>
          {props.title}
        </h2>
      )}
      {props.children}
    </section>
  );
}

export function Unauthorized() {
  return (
    <Shell title="admin only">
      <Card>
        <div style={{ color: COLORS.fgDim, marginBottom: 8 }}>
          set the <code style={{ fontFamily: FONT.mono, color: COLORS.cyan }}>panel_admin_key</code> cookie to a value in <code style={{ fontFamily: FONT.mono, color: COLORS.cyan }}>PANEL_ADMIN_KEYS</code>.
        </div>
        <pre style={{ background: '#000', padding: 10, fontSize: 11, fontFamily: FONT.mono, color: COLORS.fg, border: `1px solid ${COLORS.border}`, borderRadius: 4, overflow: 'auto' }}>
{`document.cookie = 'panel_admin_key=YOUR_KEY; path=/; samesite=lax'`}
        </pre>
      </Card>
    </Shell>
  );
}
