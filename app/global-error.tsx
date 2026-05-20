'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body style={{ background: '#0a0a0a', color: '#e6e6e6', fontFamily: 'monospace', padding: 32, margin: 0 }}>
        <h1 style={{ fontSize: 48, margin: 0 }}>500</h1>
        <p style={{ color: '#a0a0a0', marginTop: 8 }}>something broke server-side. the failure has been logged.</p>
        {error?.digest && <p style={{ color: '#707070', fontSize: 12 }}>digest: {error.digest}</p>}
        <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
          <button onClick={() => reset()} style={{ background: '#1a1a1a', color: '#e6e6e6', border: '1px solid #333', padding: '6px 12px', cursor: 'pointer' }}>
            try again
          </button>
          <a href="/" style={{ color: '#e6e6e6' }}>← /</a>
        </div>
      </body>
    </html>
  );
}
