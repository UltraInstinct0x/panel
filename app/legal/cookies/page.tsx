import { LegalPage, legalSx as sx } from '../_layout';

export const metadata = {
  title: 'cookies · panel',
  description: 'one strictly-necessary cookie. no third-party trackers. no banner.',
};

export default function CookiesPage() {
  return (
    <LegalPage title="cookies" version="v0" lastUpdated="2026-05-20">
      <section>
        <p>panel sets exactly one cookie. no third-party cookies. no analytics cookies. no advertising cookies.</p>
      </section>

      <section>
        <h2 style={sx.h2}>cookie used</h2>
        <table style={sx.table}>
          <thead><tr><th style={sx.th}>name</th><th style={sx.th}>purpose</th><th style={sx.th}>scope</th><th style={sx.th}>lifetime</th><th style={sx.th}>basis</th></tr></thead>
          <tbody>
            <tr>
              <td style={sx.td}><code>panel_rater</code></td>
              <td style={sx.td}>pseudonymous rater continuity (trust-tier accrual across visits)</td>
              <td style={sx.td}>host-only, <code>panel.goku.codes</code></td>
              <td style={sx.td}>13 months</td>
              <td style={sx.td}>strictly necessary — no banner required under GDPR/ePrivacy</td>
            </tr>
          </tbody>
        </table>
        <p style={sx.muted}>cookie value is a random opaque identifier. it carries no personal data. it is not shared with operators, ad networks, or analytics vendors.</p>
      </section>

      <section>
        <h2 style={sx.h2}>local storage / session storage</h2>
        <p>panel may use <code>localStorage</code> on <code>panel.goku.codes</code> for short-lived UI state (challenge progress, retry counters). this data never leaves your browser and is purged when challenges complete or when you clear site data.</p>
      </section>

      <section>
        <h2 style={sx.h2}>what we don&apos;t do</h2>
        <ul>
          <li>no Google Analytics, no GA4, no third-party analytics.</li>
          <li>no advertising or remarketing cookies.</li>
          <li>no session-replay or behavioral biometrics beyond aggregate counts described in <a href="/privacy">privacy</a>.</li>
          <li>no fingerprint persistence across cookie clears — by design.</li>
        </ul>
      </section>

      <section>
        <h2 style={sx.h2}>if we ever add a non-essential cookie</h2>
        <p>we&apos;ll show a consent banner before setting it, default-deny, with clear granular choices. this page will be updated at least 30 days in advance for paid operators.</p>
      </section>

      <section>
        <h2 style={sx.h2}>clearing the cookie</h2>
        <p>clear site data for <code>panel.goku.codes</code> in your browser. your trust tier and rater identity reset on next visit — by design, we cannot link the old and new sessions.</p>
      </section>
    </LegalPage>
  );
}
