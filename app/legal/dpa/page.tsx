import { LegalPage, legalSx as sx } from '../_layout';

export const metadata = {
  title: 'data processing addendum · panel',
  description: 'panel as data processor for operators. GDPR Art. 28 compliant template, v0.',
};

export default function DPAPage() {
  return (
    <LegalPage title="data processing addendum" version="v0" lastUpdated="2026-05-20">
      <section>
        <p>this addendum (&quot;DPA&quot;) forms part of the <a href="/legal/terms">terms of service</a> between the operator (&quot;controller&quot;) and panel (&quot;processor&quot;, UltraInstinct0x). it governs processing of personal data submitted by the controller to panel and applies whenever the controller is subject to GDPR, UK-GDPR, or KVKK.</p>
        <p style={sx.muted}>countersigned PDFs available on request for paid operators: <code>privacy@goku.codes</code>. v0 wording is in effect for v0 contracts; future updates trigger 30-day notice.</p>
      </section>

      <section>
        <h2 style={sx.h2}>1 — definitions</h2>
        <p>capitalized terms (Controller, Processor, Data Subject, Personal Data, Processing, Sub-Processor, Supervisory Authority) carry their GDPR Art. 4 meaning. &quot;Applicable Law&quot; means GDPR, UK-GDPR, and KVKK as applicable to the operator.</p>
      </section>

      <section>
        <h2 style={sx.h2}>2 — scope + subject matter</h2>
        <ul>
          <li><strong>subject matter</strong>: provision of the panel service.</li>
          <li><strong>duration</strong>: term of the operator account plus the post-termination export period.</li>
          <li><strong>nature + purpose</strong>: providing captcha + preference-data labeling on operator-submitted units.</li>
          <li><strong>types of personal data</strong>: pseudonymous rater identifiers; behavioral signals; IP addresses (transient, rate-limit only); any personal data the controller submits within unit content (controller&apos;s responsibility to minimize).</li>
          <li><strong>categories of data subjects</strong>: controller&apos;s end users (raters); controller&apos;s authorized account users (admin).</li>
        </ul>
      </section>

      <section>
        <h2 style={sx.h2}>3 — controller responsibilities</h2>
        <ul>
          <li>provide lawful basis for any personal data submitted in unit content.</li>
          <li>obtain consents required from end users.</li>
          <li>minimize personal data: do not embed PII, PHI, or secrets in unit content unless contracted under a signed BAA and using scrubber-proxy.</li>
          <li>respond to data-subject requests received by the controller; route DSARs that originate via panel to <code>privacy@goku.codes</code>.</li>
        </ul>
      </section>

      <section>
        <h2 style={sx.h2}>4 — processor obligations (Art. 28)</h2>
        <p>panel will:</p>
        <ul>
          <li>process personal data only on documented instructions from the controller (the terms + this DPA constitute the documented instructions).</li>
          <li>ensure persons authorized to process personal data are bound by confidentiality.</li>
          <li>implement appropriate technical and organizational measures (see annex II below).</li>
          <li>engage sub-processors only as listed at <a href="/legal/sub-processors">/legal/sub-processors</a>; give 30 days&apos; notice of additions; allow the controller to object.</li>
          <li>assist the controller with DSARs, DPIAs, and supervisory-authority engagement to the extent reasonable.</li>
          <li>notify the controller of a personal-data breach without undue delay (target: 72 hours of becoming aware).</li>
          <li>at the controller&apos;s choice on termination: delete or return personal data, subject to retention required by law.</li>
          <li>make available information necessary to demonstrate Art. 28 compliance and allow audits per section 8 below.</li>
        </ul>
      </section>

      <section>
        <h2 style={sx.h2}>5 — sub-processors</h2>
        <p>list, notice mechanism, and objection process are at <a href="/legal/sub-processors">/legal/sub-processors</a>. panel remains liable for sub-processor performance.</p>
      </section>

      <section>
        <h2 style={sx.h2}>6 — international transfers</h2>
        <p>panel is hosted in Frankfurt, DE. data exports outside the EU/EEA (e.g. to US-based sub-processors such as GitHub) rely on the EU Standard Contractual Clauses (2021/914), modules 2 or 3 as applicable, and on the UK addendum for UK transfers. SCCs are incorporated by reference; countersigned copies available on request.</p>
      </section>

      <section>
        <h2 style={sx.h2}>7 — data-subject rights</h2>
        <p>panel exposes the following to enable direct DSAR fulfillment by raters:</p>
        <ul>
          <li><code>GET /api/me/export?rater_id=&lt;id&gt;</code> — export</li>
          <li><code>POST /api/me/delete?rater_id=&lt;id&gt;</code> — erasure</li>
        </ul>
        <p>controllers may also submit batch DSAR requests to <code>privacy@goku.codes</code>; response within 30 days.</p>
      </section>

      <section>
        <h2 style={sx.h2}>8 — audits</h2>
        <p>controller may, no more than once per 12 months, request a copy of panel&apos;s most recent security documentation (annex II) and ask reasonable written questions. on-site audits are not available in v0; once SOC 2 attestation is in place, the SOC 2 report will satisfy this section. controllers in regulated verticals may negotiate additional audit rights as part of an enterprise contract.</p>
      </section>

      <section>
        <h2 style={sx.h2}>9 — return / deletion on termination</h2>
        <p>on termination of the operator account, the controller may export judgments for 30 days. after 30 days, operator-controlled unit content is deleted within 14 days, except where retention is required by law. aggregated, anonymized signal already incorporated into panel datasets persists.</p>
      </section>

      <section>
        <h2 style={sx.h2}>annex I — processing details</h2>
        <ul>
          <li><strong>nature of processing</strong>: storing, structuring, retrieving, displaying, anonymizing personal data within the captcha/labeling flow.</li>
          <li><strong>purpose</strong>: bot prevention + production of labeled preference datasets.</li>
          <li><strong>data categories</strong>: pseudonymous identifiers; behavioral aggregates; transient IP; any personal data the controller submits in unit content.</li>
          <li><strong>data subjects</strong>: end users of the controller; controller&apos;s admin users.</li>
          <li><strong>retention</strong>: per the <a href="/privacy">privacy policy</a> schedule.</li>
        </ul>
      </section>

      <section>
        <h2 style={sx.h2}>annex II — technical + organizational measures</h2>
        <ul>
          <li>TLS 1.2+ for data in transit.</li>
          <li>host-level disk encryption at rest.</li>
          <li>AES-256-GCM for reversible mappings inside scrubber-proxy.</li>
          <li>pseudonymous identifiers (random opaque <code>rater_id</code>).</li>
          <li>append-only audit logging on the operator console and ingest pipeline.</li>
          <li>rate-limit and bot-detection layers on every public endpoint.</li>
          <li>secret-key isolation: operator secret keys stored hashed; only publishable keys are exposed.</li>
          <li>least-privilege access on host: single operator (no team), key-only SSH, no shared accounts.</li>
          <li>backups: daily snapshots of the panel sqlite store, 14-day retention, encrypted.</li>
          <li>incident response: 72-hour notification window to controllers + supervisory authority.</li>
          <li>no certified attestation today (no SOC 2 / ISO 27001 yet); roadmap published at <a href="/legal/sub-processors">/legal/sub-processors</a> as those vendors come online.</li>
        </ul>
      </section>

      <section>
        <h2 style={sx.h2}>annex III — sub-processors</h2>
        <p>see <a href="/legal/sub-processors">/legal/sub-processors</a> (incorporated by reference).</p>
      </section>
    </LegalPage>
  );
}
