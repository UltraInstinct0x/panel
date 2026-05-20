import { LegalPage, legalSx as sx } from '../_layout';

export const metadata = {
  title: 'terms of service · panel',
  description: 'how operators and raters use panel.goku.codes. v0.',
};

export default function TermsPage() {
  return (
    <LegalPage title="terms of service" version="v0" lastUpdated="2026-05-20">
      <section>
        <h2 style={sx.h2}>1 — what panel is</h2>
        <p>panel.goku.codes (&quot;panel&quot;) is a captcha-shape feedback layer operated by UltraInstinct0x (&quot;we&quot;, &quot;us&quot;). when a visitor (&quot;rater&quot;) interacts with the panel widget on an operator&apos;s site, they complete one short judgment task. operators get a verification token; we retain the judgment as labeled preference data per the <a href="/privacy">privacy policy</a>.</p>
      </section>

      <section>
        <h2 style={sx.h2}>2 — accounts</h2>
        <ul>
          <li>operators register an account, receive publishable + secret keys, and are responsible for keeping secret keys confidential.</li>
          <li>raters do not require an account. a pseudonymous <code>rater_id</code> cookie is issued automatically.</li>
          <li>you must be at least 16 (EU/UK) or the local age of digital consent. panel is not directed to children under 13.</li>
        </ul>
      </section>

      <section>
        <h2 style={sx.h2}>3 — acceptable use (operators)</h2>
        <p>operators must NOT:</p>
        <ul>
          <li>submit content containing personal data (PII), secrets, credentials, or PHI unless explicitly contracted under a signed DPA/BAA and using <code>scrubber-proxy</code> in the appropriate mode.</li>
          <li>use panel to surveil identified individuals, profile protected classes, or make decisions producing legal effects on rater identity.</li>
          <li>use panel to gate content that would itself be unlawful in the operator&apos;s jurisdiction.</li>
          <li>submit unit content that depicts CSAM, terrorism content, or content otherwise prohibited under applicable law.</li>
          <li>attempt to deanonymize raters, scrape rater identifiers, or attempt to correlate <code>rater_id</code> values across operator boundaries.</li>
          <li>resell, sublicense, or redistribute panel access without a written agreement.</li>
        </ul>
        <p>operators are solely responsible for: (a) the lawfulness of unit content they submit; (b) obtaining any consents required from their own end users; (c) compliance with their own regulatory regime (HIPAA, PCI, etc.).</p>
      </section>

      <section>
        <h2 style={sx.h2}>4 — acceptable use (raters)</h2>
        <ul>
          <li>answer judgments in good faith. do not collude with other raters or coordinate vote manipulation.</li>
          <li>do not attempt to reverse-engineer trust-tier signals, honeypots, or scoring logic.</li>
          <li>do not automate panel interactions or submit machine-generated judgments.</li>
        </ul>
        <p>repeated violations result in the affected <code>rater_id</code> being downweighted to zero trust and excluded from honeypot pools.</p>
      </section>

      <section>
        <h2 style={sx.h2}>5 — data ownership</h2>
        <ul>
          <li><strong>operator content</strong> (unit prompts/artifacts submitted by an operator): owned by the operator. operator grants panel a license to process it for the purpose of running the captcha + producing the labeled dataset.</li>
          <li><strong>judgments</strong>: jointly held. the operator receives an exportable dataset of judgments on their own submitted units. panel retains aggregated, cross-org-anonymized signal for model training and quality metrics.</li>
          <li><strong>rater behavioral signals</strong>: panel-owned, retained per the <a href="/privacy">privacy policy</a> retention schedule.</li>
        </ul>
      </section>

      <section>
        <h2 style={sx.h2}>6 — fees</h2>
        <p>fee tiers, included quotas, and overage rates are published at <a href="/pricing">/pricing</a>. operators on paid tiers are billed monthly in arrears for overage via Stripe. annual prepay is non-refundable mid-cycle. unpaid balances over 30 days result in API-key suspension; over 60 days, account termination + dataset hold per section 9.</p>
      </section>

      <section>
        <h2 style={sx.h2}>7 — service levels</h2>
        <p>uptime + response-time SLAs are tier-specific (see <a href="/pricing">pricing</a>). during v0, no monetary credits attach to SLA misses; remedy is fee waiver for the affected billing period at panel&apos;s discretion. paid SLA credits begin at GA.</p>
      </section>

      <section>
        <h2 style={sx.h2}>8 — modifications</h2>
        <p>panel may modify these terms with 30 days&apos; notice (email to account address). continued use after the effective date constitutes acceptance. material changes (pricing, data-use scope) require explicit re-acceptance for paid operators.</p>
      </section>

      <section>
        <h2 style={sx.h2}>9 — termination</h2>
        <p>either party may terminate for convenience with 30 days&apos; written notice. on termination:</p>
        <ul>
          <li>operator may export their judgments dataset within 30 days via <code>/api/operator/export</code>.</li>
          <li>after 30 days, operator-controlled unit content is deleted within 14 days.</li>
          <li>aggregated, anonymized signal already incorporated into panel datasets persists.</li>
          <li>raters can independently delete their data at any time per the privacy policy.</li>
        </ul>
        <p>panel may suspend or terminate immediately for: nonpayment over 60 days; material breach of section 3 or 4; legal compulsion; or risk to platform integrity.</p>
      </section>

      <section>
        <h2 style={sx.h2}>10 — warranties + disclaimers</h2>
        <p>panel is provided <strong>as-is</strong>. no warranty of merchantability, fitness for a particular purpose, or non-infringement. panel does not warrant that the bot-detection signal is sufficient for any operator&apos;s threat model — operator is responsible for layering additional defenses.</p>
      </section>

      <section>
        <h2 style={sx.h2}>11 — limitation of liability</h2>
        <p>to the maximum extent permitted by law, panel&apos;s aggregate liability for any claim is capped at the greater of (a) USD $100 or (b) fees paid by the operator in the 12 months preceding the claim. no liability for indirect, consequential, lost-profits, or punitive damages. nothing in this section limits liability for gross negligence, willful misconduct, or where excluded by mandatory law.</p>
      </section>

      <section>
        <h2 style={sx.h2}>12 — indemnification</h2>
        <p>operator will indemnify panel against third-party claims arising from (a) operator&apos;s unit content; (b) operator&apos;s violation of section 3; (c) operator&apos;s failure to obtain consents from its end users.</p>
      </section>

      <section>
        <h2 style={sx.h2}>13 — governing law</h2>
        <p>v0: Türkiye law and İzmir courts for operators contracting with panel (UltraInstinct0x, TR şahıs şirketi). this section will be replaced post-Atlas C-Corp formation; existing contracts honor whichever forum was in effect at signature.</p>
      </section>

      <section>
        <h2 style={sx.h2}>14 — contact</h2>
        <ul>
          <li>contracts + billing: <code>billing@goku.codes</code></li>
          <li>legal notices: <code>legal@goku.codes</code></li>
          <li>abuse: <code>abuse@goku.codes</code></li>
        </ul>
      </section>
    </LegalPage>
  );
}
