// shared legal-page layout (terms, dpa, sub-processors, cookies)
import Link from 'next/link';
import React from 'react';

const sx = {
  page: { padding: '32px 24px', maxWidth: 820, margin: '0 auto', fontFamily: 'monospace', color: 'var(--fg, #e6e6e6)', lineHeight: 1.55 } as React.CSSProperties,
  warn: { padding: 12, border: '1px solid #5a3a00', background: '#1a1200', color: '#ffcf66', fontSize: 12, marginBottom: 24 } as React.CSSProperties,
  muted: { color: '#888', fontSize: 12 } as React.CSSProperties,
};

export function LegalPage({ title, version, lastUpdated, children }: { title: string; version: string; lastUpdated: string; children: React.ReactNode }) {
  return (
    <main style={sx.page}>
      <header style={{ marginBottom: 16 }}>
        <div style={sx.muted}>{title} · {version}</div>
        <h1 style={{ fontSize: 32, margin: '4px 0' }}>{title}</h1>
        <p style={sx.muted}>last updated: {lastUpdated} · effective: TBD</p>
      </header>

      <div style={sx.warn}>
        <strong>{version} — pending counsel review.</strong> reflects current panel practices. wording may change after legal review. questions: use the <a href="/contact?topic=privacy">contact form</a> (topic: privacy).
      </div>

      {children}

      <footer style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #222', fontSize: 11, color: '#707070' }}>
        <Link href="/privacy">privacy</Link> · <Link href="/legal/terms">terms</Link> · <Link href="/legal/dpa">DPA</Link> · <Link href="/legal/sub-processors">sub-processors</Link> · <Link href="/legal/cookies">cookies</Link> · <Link href="/docs">docs</Link> · <Link href="/">home</Link>
      </footer>
    </main>
  );
}

export const legalSx = {
  h2: { fontSize: 20, marginTop: 28, marginBottom: 8 } as React.CSSProperties,
  h3: { fontSize: 14, marginTop: 16, marginBottom: 4 } as React.CSSProperties,
  code: { padding: 8, background: '#111', border: '1px solid #222', display: 'block', overflowX: 'auto', fontSize: 12 } as React.CSSProperties,
  muted: { color: '#888', fontSize: 12 } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12, marginTop: 8 } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '6px 8px', borderBottom: '1px solid #333', color: '#aaa' } as React.CSSProperties,
  td: { padding: '6px 8px', borderBottom: '1px solid #1f1f1f', verticalAlign: 'top' as const } as React.CSSProperties,
};
