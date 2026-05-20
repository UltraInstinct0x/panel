import { LegalPage, legalSx as sx } from '../_layout';

export const metadata = {
  title: 'sub-processors · panel',
  description: 'third parties that touch or may touch panel-controlled data. updated on change.',
};

export default function SubProcessorsPage() {
  return (
    <LegalPage title="sub-processors" version="v0" lastUpdated="2026-05-20">
      <section>
        <p>sub-processors are third parties we use to operate panel. operators on a paid plan receive 30 days&apos; email notice before any addition or material change per the DPA.</p>
      </section>

      <section>
        <h2 style={sx.h2}>active</h2>
        <table style={sx.table}>
          <thead><tr><th style={sx.th}>vendor</th><th style={sx.th}>purpose</th><th style={sx.th}>data</th><th style={sx.th}>region</th><th style={sx.th}>terms</th></tr></thead>
          <tbody>
            <tr><td style={sx.td}>Oracle Cloud Infrastructure</td><td style={sx.td}>hosting (compute, storage, network)</td><td style={sx.td}>all panel data at rest + in motion</td><td style={sx.td}>Frankfurt, DE</td><td style={sx.td}><a href="https://www.oracle.com/legal/data-processing-agreement.html">DPA</a></td></tr>
            <tr><td style={sx.td}>Let&apos;s Encrypt (ISRG)</td><td style={sx.td}>TLS certificate issuance</td><td style={sx.td}>domain name only</td><td style={sx.td}>US</td><td style={sx.td}><a href="https://letsencrypt.org/repository/">repository</a></td></tr>
            <tr><td style={sx.td}>GitHub</td><td style={sx.td}>source code hosting</td><td style={sx.td}>code only, no production data</td><td style={sx.td}>US</td><td style={sx.td}><a href="https://docs.github.com/en/site-policy/privacy-policies/github-data-protection-agreement">DPA</a></td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2 style={sx.h2}>sibling internal services (same trust boundary)</h2>
        <table style={sx.table}>
          <thead><tr><th style={sx.th}>service</th><th style={sx.th}>purpose</th><th style={sx.th}>data</th><th style={sx.th}>location</th></tr></thead>
          <tbody>
            <tr><td style={sx.td}>scrubber-proxy</td><td style={sx.td}>PII/secret sanitization before a unit reaches a rater</td><td style={sx.td}>operator-submitted unit content</td><td style={sx.td}>same host, Frankfurt</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2 style={sx.h2}>planned (not yet active)</h2>
        <table style={sx.table}>
          <thead><tr><th style={sx.th}>vendor</th><th style={sx.th}>when</th><th style={sx.th}>purpose</th><th style={sx.th}>DPA</th></tr></thead>
          <tbody>
            <tr><td style={sx.td}>Stripe</td><td style={sx.td}>first paid plan</td><td style={sx.td}>payments + invoicing</td><td style={sx.td}><a href="https://stripe.com/legal/dpa">DPA</a></td></tr>
            <tr><td style={sx.td}>Postmark / AWS SES</td><td style={sx.td}>first transactional email</td><td style={sx.td}>operator email, verification mails</td><td style={sx.td}><a href="https://postmarkapp.com/data-processing-agreement">DPA</a></td></tr>
            <tr><td style={sx.td}>Cloudflare</td><td style={sx.td}>if CDN/WAF added</td><td style={sx.td}>request metadata, IP</td><td style={sx.td}><a href="https://www.cloudflare.com/cloudflare-customer-dpa/">DPA</a></td></tr>
            <tr><td style={sx.td}>Sentry / equivalent</td><td style={sx.td}>if error tracking added</td><td style={sx.td}>scrubbed stack traces</td><td style={sx.td}><a href="https://sentry.io/legal/dpa/">DPA</a></td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2 style={sx.h2}>evaluated and rejected</h2>
        <ul>
          <li><strong>Google Analytics / GA4</strong> — EU transfer + consent overhead; privacy-respecting alternative (Plausible/Umami self-hosted) preferred.</li>
          <li><strong>Hotjar / FullStory</strong> — session replay = behavioral biometrics; incompatible with the panel data posture.</li>
        </ul>
      </section>

      <section>
        <h2 style={sx.h2}>notice + objection</h2>
        <p>paid operators receive 30 days&apos; advance email notice for additions or material changes. operators may object in writing; if unresolved, the operator may terminate per the DPA. list reviewed quarterly.</p>
      </section>
    </LegalPage>
  );
}
