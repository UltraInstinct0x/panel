import Link from 'next/link';

export const metadata = { title: '404 · panel' };

export default function NotFound() {
  return (
    <main style={{ padding: 32, fontFamily: 'monospace', color: 'var(--fg, #e6e6e6)' }}>
      <h1 style={{ fontSize: 48, margin: 0 }}>404</h1>
      <p className="muted" style={{ marginTop: 8 }}>no unit at this route.</p>
      <p style={{ marginTop: 16 }}>
        <Link href="/">← back to /</Link>
        {' · '}
        <Link href="/demo/gate">/demo/gate</Link>
        {' · '}
        <Link href="/docs">/docs</Link>
      </p>
    </main>
  );
}
