import Link from 'next/link';

export const metadata = {
  title: 'privacy · panel',
  description: 'pseudonymous by default. minimal data. export + delete on demand.',
};

const sx = {
  page: { padding: '32px 24px', maxWidth: 820, margin: '0 auto', fontFamily: 'monospace', color: 'var(--fg, #e6e6e6)', lineHeight: 1.55 } as React.CSSProperties,
  warn: { padding: 12, border: '1px solid #5a3a00', background: '#1a1200', color: '#ffcf66', fontSize: 12, marginBottom: 24 } as React.CSSProperties,
  h2: { fontSize: 20, marginTop: 28, marginBottom: 8 } as React.CSSProperties,
  h3: { fontSize: 14, marginTop: 16, marginBottom: 4 } as React.CSSProperties,
  code: { padding: 8, background: '#111', border: '1px solid #222', display: 'block', overflowX: 'auto', fontSize: 12 } as React.CSSProperties,
  muted: { color: '#888', fontSize: 12 } as React.CSSProperties,
};

export default function PrivacyPage() {
  return (
    <main style={sx.page}>
      <header style={{ marginBottom: 16 }}>
        <div style={sx.muted}>privacy policy · draft · v0</div>
        <h1 style={{ fontSize: 32, margin: '4px 0' }}>privacy</h1>
        <p style={sx.muted}>last updated: 2026-05-20 · effective: TBD</p>
      </header>

      <div style={sx.warn}>
        <strong>DRAFT.</strong> this policy has not been reviewed by counsel. do not rely on it for legal purposes. lawyer review required before publication.
      </div>

      <section>
        <h2 style={sx.h2}>tl;dr</h2>
        <p>
          panel.goku.codes is a captcha-shape feedback layer. when you click &quot;i&apos;m human&quot; on a partner site we show you one short
          judgment task. your answer doubles as preference data for AI agents. we keep your identity pseudonymous (a random cookie id),
          collect the minimum behavioral data we need to block bots, and delete it on request.
        </p>
      </section>

      <section>
        <h2 style={sx.h2}>who we are</h2>
        <p>panel (UltraInstinct0x). contact: <code>privacy@goku.codes</code>. host: Oracle Cloud Frankfurt (DE). repo: github.com/UltraInstinct0x/panel.</p>
      </section>

      <section>
        <h2 style={sx.h2}>what we collect</h2>
        <h3 style={sx.h3}>when you interact with a panel widget</h3>
        <ul>
          <li>a random pseudonymous <code>rater_id</code> cookie on <code>panel.goku.codes</code>.</li>
          <li>your judgment: choice, latency, unit id.</li>
          <li>behavioral signals: mouse-movement summaries (counts/distances, not replay), dwell time, focus events, viewport, user-agent.</li>
          <li>IP address — used only for rate-limiting, dropped after 1 hour, never stored alongside your judgment.</li>
        </ul>
        <h3 style={sx.h3}>we do NOT collect</h3>
        <ul>
          <li>name, email, phone, government id.</li>
          <li>precise location.</li>
          <li>biometric data (summaries are aggregates, not stroke replay).</li>
          <li>payment card data (Stripe handles cards when paid plans are active).</li>
          <li>special-category data (health, religion, ethnicity, etc.).</li>
        </ul>
      </section>

      <section>
        <h2 style={sx.h2}>why we collect it (lawful basis)</h2>
        <ul>
          <li>captcha + bot prevention → legitimate interest (GDPR Art. 6(1)(f)).</li>
          <li>judgment + behavioral signals → legitimate interest; pseudonymous, no profiling that affects you.</li>
          <li>rater earnings, operator account → contract (Art. 6(1)(b)).</li>
          <li>analytics → none today; we&apos;d ask for consent before adding any.</li>
        </ul>
      </section>

      <section>
        <h2 style={sx.h2}>retention</h2>
        <ul>
          <li>judgments + behavioral signals: 90 days default. up to 24 months with opt-in.</li>
          <li>raw behavioral signals: aggregated after 30 days.</li>
          <li>audit log: 12 months minimum.</li>
          <li>rate-limit data: 1 hour.</li>
        </ul>
      </section>

      <section id="sub-processors">
        <h2 style={sx.h2}>sub-processors</h2>
        <ul>
          <li><strong>Oracle Cloud Frankfurt</strong> — hosting</li>
          <li><strong>GitHub</strong> — code only, no production data</li>
          <li><strong>Stripe</strong> — when paid plans are active</li>
          <li><strong>Postmark / SES</strong> — when transactional email is active</li>
        </ul>
        <p style={sx.muted}>we do not sell your data, share it with advertisers, or feed it to third-party AI providers without your explicit consent.</p>
      </section>

      <section>
        <h2 style={sx.h2}>your rights</h2>
        <p>regardless of where you live, you can:</p>
        <ul>
          <li>
            export your data:
            <code style={sx.code}>GET /api/me/export?rater_id=&lt;your-id&gt;</code>
          </li>
          <li>
            delete your data:
            <code style={sx.code}>POST /api/me/delete?rater_id=&lt;your-id&gt;</code>
          </li>
          <li>email <code>privacy@goku.codes</code> for rectification, restriction, objection, or complaint.</li>
        </ul>
        <p style={sx.muted}>
          we respond within 30 days. you can also complain to your DPA (BfDI in Germany, KVKK Kurumu in Türkiye, ICO in the UK, etc.).
          if you&apos;ve cleared cookies we cannot link you back — by design.
        </p>
      </section>

      <section>
        <h2 style={sx.h2}>EU / UK (GDPR)</h2>
        <p>
          panel is hosted in Frankfurt (DE). most EU/EEA operators can use panel without cross-border concerns.
          for non-EU operators, our DPA includes SCCs (2021/914) and the UK addendum where applicable.
          controller: panel (UltraInstinct0x). DPO not required (Art. 37). contact <code>privacy@goku.codes</code>.
        </p>
      </section>

      <section>
        <h2 style={sx.h2}>Türkiye (KVKK)</h2>
        <p>
          panel KVKK uyarınca veri sorumlusudur. VERBIS kayıt eşiğinin altındayız; ilk TR-resident operatör onboardingi sonrası kayıt yapılacak.
          yurt dışına veri aktarımı (Frankfurt) için açık rıza alınacak. tam aydınlatma metni <code>/tr/privacy</code> üzerinde yayımlanacak.
        </p>
      </section>

      <section>
        <h2 style={sx.h2}>USA / health data</h2>
        <p>
          panel does <strong>not</strong> collect, store, or transmit PHI by default. operators in healthcare settings must (1) sign a BAA,
          (2) route all unit content through scrubber-proxy in <code>hipaa</code> mode, and (3) configure ingest under BAA scope.
          sending PHI without a BAA violates our terms.
        </p>
      </section>

      <section>
        <h2 style={sx.h2}>automated decisions</h2>
        <p>
          <code>/api/verify</code> returns a probability score. it does not produce legal effects on you — it gives the operator a captcha pass/fail.
          email <code>privacy@goku.codes</code> if you believe a panel decision unfairly blocked you and we&apos;ll do a manual review.
        </p>
      </section>

      <section>
        <h2 style={sx.h2}>cookies</h2>
        <p>
          one cookie: <code>panel_rater</code> on <code>panel.goku.codes</code> (host-only, strictly necessary).
          no third-party cookies. no analytics. no ads. no banner required today.
          we&apos;ll show a banner the moment any non-essential cookie is added.
        </p>
      </section>

      <section>
        <h2 style={sx.h2}>security</h2>
        <p>
          TLS in transit, host-level disk encryption, AES-256-GCM for reversible mappings in scrubber-proxy, pseudonymous identifiers,
          append-only audit logging, ratelimit + bot detection. not certified (SOC 2 / ISO 27001).
        </p>
      </section>

      <section>
        <h2 style={sx.h2}>breaches</h2>
        <p>72h notification to the supervisory authority (GDPR Art. 33). high-risk: notify affected individuals without undue delay (Art. 34).</p>
      </section>

      <section>
        <h2 style={sx.h2}>children</h2>
        <p>not directed to people under 13. we do not knowingly collect data from children.</p>
      </section>

      <section>
        <h2 style={sx.h2}>changes</h2>
        <p>material changes posted at the top of this page with a new &quot;last updated&quot; date. operators notified by email.</p>
      </section>

      <section>
        <h2 style={sx.h2}>contact</h2>
        <ul>
          <li>privacy + DSAR: <code>privacy@goku.codes</code></li>
          <li>security: <code>security@goku.codes</code></li>
          <li>general: <code>hi@goku.codes</code></li>
        </ul>
      </section>

      <footer style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #222', fontSize: 11, color: '#707070' }}>
        <Link href="/terms">terms</Link> · <Link href="/docs">docs</Link> · <Link href="/">home</Link>
      </footer>
    </main>
  );
}
