import Link from 'next/link';

export const metadata = {
  title: 'terms · panel',
  description: 'terms of service — draft.',
};

const sx = {
  page: { padding: '32px 24px', maxWidth: 820, margin: '0 auto', fontFamily: 'monospace', color: 'var(--fg, #e6e6e6)', lineHeight: 1.55 } as React.CSSProperties,
  warn: { padding: 12, border: '1px solid #5a3a00', background: '#1a1200', color: '#ffcf66', fontSize: 12, marginBottom: 24 } as React.CSSProperties,
  h2: { fontSize: 20, marginTop: 28, marginBottom: 8 } as React.CSSProperties,
  muted: { color: '#888', fontSize: 12 } as React.CSSProperties,
};

export default function TermsPage() {
  return (
    <main style={sx.page}>
      <header style={{ marginBottom: 16 }}>
        <div style={sx.muted}>terms of service · draft · v0</div>
        <h1 style={{ fontSize: 32, margin: '4px 0' }}>terms</h1>
        <p style={sx.muted}>last updated: 2026-05-20 · effective: TBD</p>
      </header>

      <div style={sx.warn}>
        <strong>DRAFT.</strong> not legal advice. lawyer review required before publication.
      </div>

      <section>
        <h2 style={sx.h2}>1 · the service</h2>
        <p>
          panel.goku.codes (&quot;panel&quot;, &quot;we&quot;) provides a captcha-shape human-verification widget and an associated
          preference-data substrate. by using the service — as a rater, an operator, or an end-visitor on an integrated site — you agree to these terms.
        </p>
      </section>

      <section>
        <h2 style={sx.h2}>2 · accounts</h2>
        <ul>
          <li>raters are pseudonymous; no account is required beyond a cookie.</li>
          <li>operators must provide accurate contact info, keep their secret key confidential, and notify us immediately on suspected compromise.</li>
        </ul>
      </section>

      <section>
        <h2 style={sx.h2}>3 · operator obligations</h2>
        <ul>
          <li>provide a lawful basis to send unit content through panel; you are the data controller for content you submit.</li>
          <li>do not submit personally-identifying or special-category data (including PHI) without a signed DPA / BAA with panel.</li>
          <li>route unit content through scrubber-proxy where applicable.</li>
          <li>do not attempt to deanonymize raters, scrape units in bulk, fingerprint visitors beyond what the widget exposes, or train AI models on judgment data without a license.</li>
        </ul>
      </section>

      <section>
        <h2 style={sx.h2}>4 · rater obligations</h2>
        <ul>
          <li>answer honestly. honeypot units detect bad-faith answers and flag your account.</li>
          <li>do not run automated scripts against the widget.</li>
          <li>one human per rater_id. multi-accounting voids earnings.</li>
        </ul>
      </section>

      <section>
        <h2 style={sx.h2}>5 · acceptable use</h2>
        <ul>
          <li>no unlawful content. no harassment. no content targeting minors.</li>
          <li>no attempts to bypass rate limits, bot detection, or attestation tokens.</li>
          <li>no reverse engineering of the gold-agreement scoring logic.</li>
        </ul>
      </section>

      <section>
        <h2 style={sx.h2}>6 · earnings + payouts</h2>
        <p>
          rater earnings are advisory until payout thresholds are reached. earnings can be voided if honeypot signal indicates bad-faith judgments
          or multi-accounting. payouts (when enabled) follow Stripe Connect terms.
        </p>
      </section>

      <section>
        <h2 style={sx.h2}>7 · privacy</h2>
        <p>see <Link href="/privacy">/privacy</Link>. data export at <code>/api/me/export</code>, deletion at <code>/api/me/delete</code>.</p>
      </section>

      <section>
        <h2 style={sx.h2}>8 · intellectual property</h2>
        <p>
          unit content remains the property of the submitting operator (or their upstream source).
          aggregated, anonymized preference data may be used by panel to improve the service and to license to operators under separate panel-data terms.
        </p>
      </section>

      <section>
        <h2 style={sx.h2}>9 · disclaimers</h2>
        <p>
          provided &quot;as is&quot;. no SLA on v0. panel is not certified to SOC 2, ISO 27001, HIPAA, or PCI-DSS.
          do not use panel as your sole control for high-risk decisions (account takeover prevention on financial systems, etc.).
        </p>
      </section>

      <section>
        <h2 style={sx.h2}>10 · liability</h2>
        <p>
          to the maximum extent permitted by law, panel&apos;s aggregate liability for any claim arising out of the service shall not exceed
          the greater of (a) fees you paid in the 12 months prior, or (b) €100. nothing in these terms limits liability for gross negligence,
          willful misconduct, or anything that cannot legally be limited.
        </p>
      </section>

      <section>
        <h2 style={sx.h2}>11 · termination</h2>
        <p>
          we may suspend or terminate access for material breach. you may stop using the service at any time. on termination,
          your data is handled per <Link href="/privacy">/privacy</Link>.
        </p>
      </section>

      <section>
        <h2 style={sx.h2}>12 · governing law</h2>
        <p>governing law: Germany (Frankfurt am Main) for EU operators. local mandatory consumer-protection rules continue to apply.</p>
      </section>

      <section>
        <h2 style={sx.h2}>13 · changes</h2>
        <p>material changes posted at the top of this page with a new &quot;last updated&quot; date and emailed to operators on a paid plan.</p>
      </section>

      <section>
        <h2 style={sx.h2}>14 · contact</h2>
        <p>legal + general: use the <a href="/contact?topic=general">contact form</a> (topic: general or legal). security reports: <a href="/contact?topic=security">contact form</a> (topic: security).</p>
      </section>

      <footer style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #222', fontSize: 11, color: '#707070' }}>
        <Link href="/privacy">privacy</Link> · <Link href="/docs">docs</Link> · <Link href="/">home</Link>
      </footer>
    </main>
  );
}
