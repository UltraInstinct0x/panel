// /pricing — v0 published. dataset-return is the wedge, not the footnote.
import Link from 'next/link';
import Nav from '../_components/Nav';

export const metadata = {
  title: 'pricing · panel',
  description: 'a captcha that asks visitors to judge real agent work. free for sites that need bot protection — paying operators get the dataset.',
};

const sx = {
  page: { padding: '32px 24px 80px', maxWidth: 1080, margin: '0 auto', fontFamily: 'monospace', color: 'var(--fg, #e6e6e6)', lineHeight: 1.55 } as React.CSSProperties,
  h1: { fontSize: 32, margin: '4px 0 8px' } as React.CSSProperties,
  lede: { color: '#a1a1aa', fontSize: 14, maxWidth: 760, margin: '0 0 32px' } as React.CSSProperties,
  warn: { padding: 12, border: '1px solid #5a3a00', background: '#1a1200', color: '#ffcf66', fontSize: 12, marginBottom: 24 } as React.CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 32 } as React.CSSProperties,
  card: { border: '1px solid #222', background: '#0e0f15', borderRadius: 6, padding: 18, display: 'flex', flexDirection: 'column' as const, gap: 8 } as React.CSSProperties,
  cardHot: { border: '1px solid #67e8f9', background: '#0e1a22' } as React.CSSProperties,
  tier: { font: '600 13px/1.2 "JetBrains Mono",monospace', color: '#67e8f9', letterSpacing: '0.08em', textTransform: 'uppercase' as const } as React.CSSProperties,
  price: { font: '600 26px/1.1 "Inter",sans-serif', color: '#fafafa', margin: '6px 0' } as React.CSSProperties,
  priceSub: { color: '#71717a', fontSize: 11 } as React.CSSProperties,
  feat: { fontSize: 12, color: '#cfcfcf', lineHeight: 1.6, listStyle: 'none', padding: 0, margin: '8px 0 0' } as React.CSSProperties,
  cta: { display: 'inline-block', marginTop: 'auto', padding: '8px 12px', background: '#163243', color: '#fafafa', border: '1px solid #67e8f9', borderRadius: 4, textDecoration: 'none', fontSize: 12, textAlign: 'center' as const } as React.CSSProperties,
  h2: { fontSize: 18, margin: '32px 0 8px' } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12, marginBottom: 24 } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '8px', borderBottom: '1px solid #333', color: '#aaa', fontWeight: 600 } as React.CSSProperties,
  td: { padding: '8px', borderBottom: '1px solid #1f1f1f', verticalAlign: 'top' as const } as React.CSSProperties,
  muted: { color: '#888', fontSize: 12 } as React.CSSProperties,
  pill: { display: 'inline-block', padding: '2px 8px', background: '#0d2236', border: '1px solid #244463', borderRadius: 999, color: '#67e8f9', fontSize: 10, marginLeft: 6 } as React.CSSProperties,
};

const tiers = [
  { name: 'Free', price: '$0', sub: 'hosted · captcha-only', cta: 'get widget key', href: '/onboard?plan=free', features: ['unlimited verifies on captcha-protected pages', 'real human-judgment tasks (not pick-a-bus)', 'rotates from live operator traffic — bots can\'t pre-scrape', 'panel branding on widget', '1 domain · community support', 'no dataset access (your visitors judge, paying ops keep labels)'] },
  { name: 'Design Partner', price: '$99', sub: 'per month · 25k verifies included', cta: 'apply', href: '/onboard', features: ['25k api calls/mo · $0.0020 overage', '30-day judgment dataset retention', 'csv/json export on demand', 'core + 1 vertical scrubber pack', '3 operator domains · email support 48h', 'preview cross-org pool (1k units sampled)'] },
  { name: 'Starter', price: '$199', sub: 'per month · 100k verifies included', cta: 'start', href: '/onboard', features: ['100k api calls/mo · $0.0018 overage', '90-day judgment dataset retention', 'csv/json export + api', 'core + 2 vertical scrubber packs', '5 operator domains · email support 24h', 'preview cross-org pool (10k units sampled)'], hot: true },
  { name: 'Growth', price: '$499', sub: 'per month · 500k verifies included', cta: 'contact', href: '/contact?topic=growth', features: ['500k api calls/mo · $0.0015 overage', '12-month dataset retention', 'csv/json + api + webhook', 'all vertical scrubber packs', '10 operator domains · 24h response, 99.5% uptime', 'full read access to cross-org pool', 'full theme widget'] },
  { name: 'Enterprise', price: '$2k+', sub: 'platform fee + commit · annual', cta: 'contact', href: '/contact?topic=enterprise', features: ['≥ 5M verifies baseline · $0.0010 overage', 'unlimited retention · queryable api', 'signed DPA, SCC, BAA on request', 'private scrubber rule packs', 'dedicated slack, 4h response, 99.9% uptime + named CSM', 'US/EU/regional dedicated stack', 'react/svelte widget source'] },
];

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main style={sx.page}>
        <header>
          <div style={sx.muted}>pricing · v0</div>
          <h1 style={sx.h1}>preference-data captcha.</h1>
          <p style={sx.lede}>
            a captcha that blocks bots by asking visitors to judge real work — agent outputs, skill diffs,
            pairwise comparisons. <strong>free for any site that needs bot protection.</strong> the labels
            your visitors produce flow into the pool that powers it, paying operators get the dataset and
            fund the free tier. you protect your page, we improve the model, no one trains on stolen captchas.
          </p>
        </header>

        <div style={sx.warn}>
          <strong>v0 published pricing.</strong> free tier is open — drop the widget on any page that needs bot protection. design-partner slots open for operators who want the dataset. lock-in for first 10 DPs at v0 rates for 12 months.
        </div>

        <div style={sx.grid}>
          {tiers.map(t => (
            <div key={t.name} style={t.hot ? { ...sx.card, ...sx.cardHot } : sx.card}>
              <div style={sx.tier}>{t.name}{t.hot && <span style={sx.pill}>recommended</span>}</div>
              <div style={sx.price}>{t.price}</div>
              <div style={sx.priceSub}>{t.sub}</div>
              <ul style={sx.feat}>
                {t.features.map(f => <li key={f}>· {f}</li>)}
              </ul>
              <a href={t.href} style={sx.cta}>{t.cta}</a>
            </div>
          ))}
        </div>

        <h2 style={sx.h2}>the wedge — what makes this different</h2>
        <table style={sx.table}>
          <thead>
            <tr>
              <th style={sx.th}></th>
              <th style={sx.th}>turnstile</th>
              <th style={sx.th}>reCAPTCHA Enterprise</th>
              <th style={sx.th}>hCaptcha Enterprise</th>
              <th style={sx.th}>scale.ai / surge</th>
              <th style={sx.th} colSpan={1}>panel</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={sx.td}>price</td><td style={sx.td}>free</td><td style={sx.td}>~$0.001/call &gt; 10k/mo</td><td style={sx.td}>$0.0005–0.001/call ent</td><td style={sx.td}>$50k+ contracts</td><td style={sx.td}>$0.0010–0.0020/call</td></tr>
            <tr><td style={sx.td}>agent-output preference data</td><td style={sx.td}>—</td><td style={sx.td}>—</td><td style={sx.td}>—</td><td style={sx.td}>yes (managed)</td><td style={sx.td}><strong>yes (self-serve)</strong></td></tr>
            <tr><td style={sx.td}>dataset goes to operator</td><td style={sx.td}>no</td><td style={sx.td}>no</td><td style={sx.td}>no (vendor keeps it)</td><td style={sx.td}>yes</td><td style={sx.td}><strong>yes</strong></td></tr>
            <tr><td style={sx.td}>compliance posture</td><td style={sx.td}>CF baseline</td><td style={sx.td}>Google data terms</td><td style={sx.td}>hcaptcha DPA</td><td style={sx.td}>SOC 2</td><td style={sx.td}>GDPR + KVKK; HIPAA roadmap; scrubber-proxy first</td></tr>
            <tr><td style={sx.td}>bot resistance</td><td style={sx.td}>medium (token-based)</td><td style={sx.td}>medium-high (risk score)</td><td style={sx.td}>medium-high (image proof-of-work)</td><td style={sx.td}>n/a (not captcha)</td><td style={sx.td}><strong>high — tasks rotate from live operator traffic, can&apos;t be pre-scraped or pre-solved by an LLM</strong></td></tr>
            <tr><td style={sx.td}>turnaround</td><td style={sx.td}>instant</td><td style={sx.td}>instant</td><td style={sx.td}>instant</td><td style={sx.td}>weeks per batch</td><td style={sx.td}>real-time (visitor traffic IS the workforce)</td></tr>
          </tbody>
        </table>

        <h2 style={sx.h2}>overage + caps</h2>
        <ul>
          <li>billed monthly in arrears, line-item per 1k calls.</li>
          <li>soft cap = 10× pool; returns 429 + email prompt to upgrade.</li>
          <li>hard cap = 100× pool; returns 503 + alerts panel side (DDoS guard).</li>
          <li>incomplete verifications don&apos;t bill.</li>
        </ul>

        <h2 style={sx.h2}>annual</h2>
        <p>flat 17% off paid tiers (&quot;2 months free&quot;). annual prepay non-refundable mid-cycle. free tier is already free, no annual to discount.</p>

        <h2 style={sx.h2}>enterprise — what makes a deal enterprise</h2>
        <p>any one of:</p>
        <ul>
          <li>&gt; 5M verifies/mo expected</li>
          <li>regulated vertical with signed DPA + custom retention (medical, legal, finance)</li>
          <li>EU data residency required</li>
          <li>BAA needed (post-HIPAA roadmap)</li>
          <li>private scrubber rule pack</li>
          <li>white-label widget (no panel branding)</li>
          <li>procurement requires MSA, redlines, security questionnaire</li>
        </ul>
        <p>base = $2k/mo platform fee + custom usage commit. 12-month contracts. NET-30 or NET-60, invoiced (not card). 10% annual-prepay discount on top.</p>

        <h2 style={sx.h2}>not yet priced (roadmap)</h2>
        <ul>
          <li><strong>panel-data API</strong> — queryable aggregated cross-org dataset, separate SKU (~$1k/mo read, ~$5k/mo read+exports).</li>
          <li><strong>scrubber-proxy standalone</strong> — sanitization-events priced, separate SKU.</li>
          <li><strong>judge models</strong> trained on the dataset — post-GA, contract-only.</li>
        </ul>

        <h2 style={sx.h2}>things explicitly NOT in pricing</h2>
        <ul>
          <li>no per-seat pricing — operators have API keys, not seats.</li>
          <li>no per-domain pricing inside a tier — we cap, we don&apos;t meter per domain.</li>
          <li>no &quot;premium support&quot; upsell — SLA is a tier feature, not a bolt-on.</li>
          <li>no captcha-bypass-as-a-service — the whole point is we don&apos;t bypass.</li>
          <li>no &quot;remove panel branding&quot; upsell on lower tiers — always branded on free/DP/Starter; clean on Growth+/Enterprise.</li>
        </ul>

        <footer style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #222', fontSize: 11, color: '#707070' }}>
          <Link href="/privacy">privacy</Link> · <Link href="/legal/terms">terms</Link> · <Link href="/legal/dpa">DPA</Link> · <Link href="/legal/sub-processors">sub-processors</Link> · <Link href="/legal/cookies">cookies</Link> · <Link href="/demo/agent">agent demo</Link> · <Link href="/">home</Link>
        </footer>
      </main>
    </>
  );
}
