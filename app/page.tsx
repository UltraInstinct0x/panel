import Link from 'next/link';
import Nav from './_components/Nav';

export default function Home() {
  return (
    <>
      <Nav />
      <div className="container">
        <h1>panel</h1>
        <p className="muted">
          a captcha you don&apos;t hate. visitors prove they&apos;re human by judging one piece of agent output.
          the judgment goes back to the operator as preference data. recaptcha trains google&apos;s self-driving cars
          on your visitors. panel trains your own systems.
        </p>

        <div style={{ marginTop: 16 }}>
          <Link href="/demo/gate" className="badge badge-accent" style={{ marginRight: 8 }}>
            try the gate →
          </Link>
          <Link href="/operator" className="badge">operator view</Link>
        </div>

        <hr />

        <h3>three reasons this isn&apos;t the captcha you hate</h3>
        <div className="grid-2">
          <div className="card">
            <strong>1. the work is the proof</strong>
            <p className="muted" style={{ margin: '8px 0 0' }}>
              no traffic-light squares. one taste judgment — pick the better headline, flag the off-sync dub,
              rank three replies. takes 3 seconds. the answer is a row of preference data you own.
            </p>
          </div>
          <div className="card">
            <strong>2. the pool is split so flagships can&apos;t farm it</strong>
            <p className="muted" style={{ margin: '8px 0 0' }}>
              public captcha pool is taste, sarcasm, dub-sync, voice-naturalness, perception. things a frontier LLM
              cannot reliably solve in 2026. technical judgments (code, traces, hallucination calls) never touch
              anonymous raters — they flow through a paid trust-tier pipeline. this is the wedge. see D12.
            </p>
          </div>
          <div className="card">
            <strong>3. defense-in-depth, not just a checkbox</strong>
            <p className="muted" style={{ margin: '8px 0 0' }}>
              behavioral floor (mouse, dwell, focus entropy). engagement window. honeypot units where the
              obvious-LLM-answer is wrong by design. opaque scoring — the token issues unconditionally, the
              probability resolves hours later once humans agree. bots can&apos;t tight-loop the verifier.
            </p>
          </div>
          <div className="card">
            <strong>+ the compliance envelope ships standalone</strong>
            <p className="muted" style={{ margin: '8px 0 0' }}>
              scrubber-proxy sits in front of the unit pool. GDPR / KVKK / HIPAA-aware redaction before any
              judgment leaves your stack. use the proxy on its own if you want.
            </p>
          </div>
        </div>

        <hr />

        <h3>drop in</h3>
        <pre style={{ background: 'var(--bg-2, #0e0e0e)', padding: 16, borderRadius: 6, overflow: 'auto', fontSize: 12 }}>
{`<script src="https://panel.goku.codes/sdk.js" async></script>
<div data-panel data-operator-key="op_xxx"></div>

// on success: a token. verify server-side.
fetch('https://panel.goku.codes/api/verify', {
  method: 'POST',
  headers: { 'x-operator-key': process.env.PANEL_KEY },
  body: JSON.stringify({ token })
})`}
        </pre>
        <p className="faint" style={{ fontSize: 12 }}>
          the iframe widget at <code>/embed</code> works today. the script tag is the alpha shape. PoC, not GA.
        </p>

        <hr />

        <h3>demo surfaces</h3>
        <div className="grid-2">
          <Link href="/demo/gate" className="card" style={{ borderColor: 'var(--accent)' }}>
            <div className="row-between">
              <strong>/demo/gate</strong>
              <span className="badge badge-accent">start here</span>
            </div>
            <p className="muted" style={{ margin: '8px 0 0' }}>fake signup form. judge one unit, get through.</p>
          </Link>

          <Link href="/embed" className="card">
            <div className="row-between">
              <strong>/embed</strong>
              <span className="badge">iframe SDK</span>
            </div>
            <p className="muted" style={{ margin: '8px 0 0' }}>postMessage handshake. embeddable today.</p>
          </Link>

          <Link href="/dashboard" className="card">
            <div className="row-between">
              <strong>/dashboard</strong>
              <span className="badge">rater view</span>
            </div>
            <p className="muted" style={{ margin: '8px 0 0' }}>recent judgments, trust score, agreement.</p>
          </Link>

          <Link href="/operator" className="card">
            <div className="row-between">
              <strong>/operator</strong>
              <span className="badge">operator view</span>
            </div>
            <p className="muted" style={{ margin: '8px 0 0' }}>operator key, embed snippet, traffic, dataset preview.</p>
          </Link>
        </div>

        <hr />

        <h3>where it is today</h3>
        <ul className="muted">
          <li>persistent sqlite. judgments survive restart.</li>
          <li>D12 pool split implemented. public pool = taste, dub-sync, sarcasm, perception.</li>
          <li>behavioral signal collection (mouse, dwell, focus) per judgment.</li>
          <li>honeypot units seeded. operator-key auth on verify.</li>
          <li>0 paying customers. pre-launch, design-partner pricing only.</li>
          <li>no SOC 2. no BAA. don&apos;t put it in front of PHI yet.</li>
        </ul>

        <hr />

        <h3>who this is for</h3>
        <ul className="muted">
          <li>indie ticketing — anti-scalping where verified-fan is already defeated.</li>
          <li>paid newsletter writers — bot-sub deliverability tanking your open rates.</li>
          <li>DTC shopify (non-plus) — card-testing bots polluting your meta pixel.</li>
          <li>seed-stage telemed — OTP toll-fraud before the SMS fires.</li>
          <li>creators on direct-stripe — chargeback evidence packet at purchase confirm.</li>
        </ul>

        <p className="faint" style={{ marginTop: 32, fontSize: 11 }}>
          panel · proof of concept · <a href="https://github.com/UltraInstinct0x/panel">github</a>
        </p>
      </div>
    </>
  );
}
