import Link from 'next/link';

export default function DocsPage() {
  return (
    <main style={{ padding: '32px 24px', maxWidth: 820, margin: '0 auto', fontFamily: 'monospace', color: 'var(--fg, #e6e6e6)', lineHeight: 1.55 }}>
      <header style={{ marginBottom: 32 }}>
        <div className="muted" style={{ fontSize: 11 }}>operator docs · v0 · 5-min skim</div>
        <h1 style={{ fontSize: 36, margin: '4px 0' }}>panel-gate · integration</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          drop-in human-verification widget. one click per visitor; the answer doubles as preference data.
          public-pool units only — flagships can&apos;t solve taste reliably (D12).
        </p>
        <nav style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
          <a href="#install">1. install</a>
          <a href="#verify">2. verify server-side</a>
          <a href="#keys">3. site keys</a>
          <a href="#raters">4. what raters see</a>
        </nav>
      </header>

      <section id="install" style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, marginBottom: 8 }}>1 · install</h2>
        <p>pick one. iframe is recommended for sites with strict CSP.</p>
        <h3 style={{ fontSize: 14, marginTop: 16, marginBottom: 6 }}>iframe (recommended)</h3>
        <pre style={{ padding: 12, background: '#111', border: '1px solid #222', overflowX: 'auto', fontSize: 12 }}>{`<iframe
  src="https://panel.goku.codes/embed?site_key=pk_demo_a"
  width="420" height="320"
  style="border:0;background:transparent"
  title="panel verification"
></iframe>
<script>
window.addEventListener('message', e => {
  if (e.origin !== 'https://panel.goku.codes') return;
  if (e.data?.type === 'panel:solved') {
    // attach e.data.token to your form / next API call
    document.querySelector('input[name=panel_token]').value = e.data.token;
  }
});
</script>`}</pre>
        <h3 style={{ fontSize: 14, marginTop: 20, marginBottom: 6 }}>direct widget route</h3>
        <pre style={{ padding: 12, background: '#111', border: '1px solid #222', overflowX: 'auto', fontSize: 12 }}>{`<a href="https://panel.goku.codes/widget?site_key=pk_demo_a" target="_blank">
  verify with panel →
</a>`}</pre>
      </section>

      <section id="verify" style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, marginBottom: 8 }}>2 · verify the token server-side</h2>
        <p>
          on form submit, POST the token to <code>/api/verify</code>. response includes a probability score, trust tier, and behavioral flag.
          do this server-side — never trust the client copy.
        </p>
        <h3 style={{ fontSize: 14, marginTop: 16, marginBottom: 6 }}>curl</h3>
        <pre style={{ padding: 12, background: '#111', border: '1px solid #222', overflowX: 'auto', fontSize: 12 }}>{`curl -s https://panel.goku.codes/api/verify \\
  -H 'content-type: application/json' \\
  -H 'X-Panel-Secret: sk_test_REPLACE' \\
  -d '{"token":"PANEL_TOKEN_FROM_CLIENT"}'

# {"ok": true, "score": 0.81, "trust": 0.74, "honeypot_failed": false}`}</pre>
        <h3 style={{ fontSize: 14, marginTop: 20, marginBottom: 6 }}>node (fetch)</h3>
        <pre style={{ padding: 12, background: '#111', border: '1px solid #222', overflowX: 'auto', fontSize: 12 }}>{`const r = await fetch('https://panel.goku.codes/api/verify', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'X-Panel-Secret': process.env.PANEL_SECRET,
  },
  body: JSON.stringify({ token }),
});
const { ok, score, honeypot_failed } = await r.json();
if (!ok || honeypot_failed || score < 0.5) return res.status(403).end('blocked');`}</pre>
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          tokens are single-use (jti ledger) and expire in ~10min. opaque scoring: the score may shift hours later as more humans rate the same unit (D13.5).
        </p>
      </section>

      <section id="keys" style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, marginBottom: 8 }}>3 · site keys</h2>
        <p>
          each origin gets a publishable <code>pk_</code> key (client-side, lives in HTML) and a server <code>sk_</code> secret (env var only).
          dev keys: <code>pk_demo_a</code> works against panel.goku.codes for testing — do not ship to prod.
        </p>
        <ul>
          <li>rotate secrets via the <Link href="/operator">/operator</Link> console.</li>
          <li>per-key rate limit is enforced (token-bucket; see <code>middleware.ts</code>).</li>
          <li>compliance scrubbing happens upstream at <code>scrubber.goku.codes</code> before any unit text reaches a rater.</li>
        </ul>
      </section>

      <section id="raters" style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 22, marginBottom: 8 }}>4 · what raters see</h2>
        <p>
          poke around <Link href="/demo/gate">/demo/gate</Link> to see the visitor view. unit types in the public pool:
        </p>
        <ul>
          <li><b>taste_rank</b> — pick the best of 3 (UI copy, slogans, error messages)</li>
          <li><b>sarcasm_detect</b> / <b>ai_vs_real</b> — binary judgment</li>
          <li><b>dub_sync</b> — short CC clip + binary judgment on a/v alignment</li>
          <li><b>drag_to_rank</b> — reorder 4 items (motor-control gate, D13.3)</li>
          <li><b>span_highlight</b> — click first/last word to mark a span (motor-control gate, D13.3)</li>
        </ul>
        <p className="muted" style={{ fontSize: 12 }}>
          technical units (code review, agent traces) never reach anonymous raters — they flow through the paid trust pipeline (D12 split).
        </p>
      </section>

      <footer style={{ marginTop: 48, paddingTop: 16, borderTop: '1px solid #222', fontSize: 11, color: '#707070' }}>
        repo: github.com/UltraInstinct0x/panel · status: <Link href="/api/health">/api/health</Link>
      </footer>
    </main>
  );
}
