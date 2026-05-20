'use client';

import Link from 'next/link';
import Nav from './_components/Nav';

const SNIPPET = `<script src="https://panel.goku.codes/sdk.js" async></script>
<div data-panel data-operator-key="op_xxx"></div>

// on success: a token. verify server-side.
fetch('https://panel.goku.codes/api/verify', {
  method: 'POST',
  headers: { 'x-operator-key': process.env.PANEL_KEY },
  body: JSON.stringify({ token })
})`;

export default function Home() {
  const copy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(SNIPPET).catch(() => {});
    }
  };

  return (
    <>
      <Nav />

      {/* HERO */}
      <section className="hero">
        <div className="container">
          <span className="hero-eyebrow">proof of concept · alpha</span>
          <h1>the captcha that pays you back in data.</h1>
          <p className="hero-sub">
            visitors prove they&apos;re human by judging one piece of agent output.
            the judgment goes back to the operator as preference data. recaptcha trains
            google&apos;s self-driving cars on your visitors. panel trains your own systems.
          </p>
          <div className="hero-ctas">
            <Link href="/demo/gate" className="btn btn-primary">try the gate</Link>
            <a href="#embed" className="btn">see the embed</a>
          </div>

          <div className="live-frame">
            <div className="live-iframe-wrap">
              <iframe src="/embed" loading="lazy" title="live panel widget" />
            </div>
            <div className="live-caption">
              <span className="live-dot" />
              live · running now
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section">
        <div className="container">
          <div className="section-eyebrow">how it works</div>
          <h2 className="section-title">three seconds. one judgment. one row of preference data.</h2>
          <p className="section-sub">
            no traffic-light squares, no rotating cubes. visitors pick the better headline,
            flag the off-sync dub, rank three replies. the answer is the proof.
          </p>

          <div className="grid-3">
            <div className="step-card">
              <div className="step-num">01</div>
              <div className="step-title">the work is the proof</div>
              <p className="step-body">
                one taste judgment, three seconds. solving it produces a labelled row
                you own. the friction becomes the dataset.
              </p>
            </div>
            <div className="step-card">
              <div className="step-num">02</div>
              <div className="step-title">the pool is split so flagships can&apos;t farm it</div>
              <p className="step-body">
                public pool is taste, sarcasm, dub-sync, perception. things a frontier
                LLM cannot reliably solve in 2026. technical judgments stay paid-tier.
              </p>
            </div>
            <div className="step-card">
              <div className="step-num">03</div>
              <div className="step-title">defense-in-depth, not a checkbox</div>
              <p className="step-body">
                behavioral floor, engagement window, honeypot units, opaque scoring.
                the token issues now; the probability resolves once humans agree.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT VISITORS SEE */}
      <section className="section">
        <div className="container">
          <div className="section-eyebrow">what visitors see</div>
          <h2 className="section-title">three unit shapes. one widget.</h2>
          <p className="section-sub">
            the public pool rotates across formats so the verifier never feels repetitive
            and the dataset stays varied.
          </p>

          <div className="grid-3">
            <div className="mockup">
              <div className="bubble">oh wow, another monday. can&apos;t wait.</div>
              <div className="bubble right" style={{ background: 'rgba(103,232,249,0.08)', borderColor: 'rgba(103,232,249,0.25)' }}>
                sarcastic
              </div>
              <div className="bubble right" style={{ opacity: 0.5 }}>literal</div>
              <div className="mockup-cap">sarcasm · pick the reading</div>
            </div>

            <div className="mockup">
              <div className="row" style={{ gap: 10, alignItems: 'stretch' }}>
                <div className="tcard">
                  <div style={{ fontWeight: 590, marginBottom: 6 }}>option a</div>
                  <div style={{ color: 'var(--fg-dim)', fontSize: 12 }}>
                    crisp, balanced, a little smoky on the finish.
                  </div>
                </div>
                <div className="tcard" style={{ borderColor: 'rgba(103,232,249,0.3)' }}>
                  <div style={{ fontWeight: 590, marginBottom: 6, color: 'var(--accent)' }}>option b</div>
                  <div style={{ color: 'var(--fg-dim)', fontSize: 12 }}>
                    bright, citrus-forward, snappier mouthfeel.
                  </div>
                </div>
              </div>
              <div className="mockup-cap">taste · rank a vs b</div>
            </div>

            <div className="mockup">
              <div className="video-frame" />
              <div className="mockup-cap">dub-sync · flag the drift</div>
            </div>
          </div>
        </div>
      </section>

      {/* DASHBOARD SCREENSHOT */}
      <section className="section">
        <div className="container">
          <div className="section-eyebrow">operator surface</div>
          <h2 className="section-title">a live dashboard, not a billing page.</h2>
          <p className="section-sub">
            operators see solve-rate, bot-flag rate, dataset growth, top raters.
            every column links back to the unit, the judgment, the trust score.
          </p>

          <div className="screenshot-wrap">
            <img src="/screenshots/dashboard.png" alt="panel dashboard" />
          </div>
        </div>
      </section>

      {/* DROP IN */}
      <section className="section" id="embed">
        <div className="container">
          <div className="section-eyebrow">drop in</div>
          <h2 className="section-title">two tags. one verify call.</h2>
          <p className="section-sub">
            the iframe widget at <code>/embed</code> works today. the script tag is the
            alpha shape — PoC, not GA. verify the token server-side with your operator key.
          </p>

          <div className="code-wrap">
            <div className="code-wrap-head">
              <span>installation</span>
              <button className="copy-btn" onClick={copy}>copy</button>
            </div>
            <pre>{SNIPPET}</pre>
          </div>
        </div>
      </section>

      {/* WHERE IT IS TODAY + WHO */}
      <section className="section">
        <div className="container">
          <div className="grid-2">
            <div>
              <div className="section-eyebrow">where it is today</div>
              <h3 style={{ marginBottom: 16 }}>shipped in the PoC</h3>
              <div className="pill-row">
                <span className="badge">persistent sqlite</span>
                <span className="badge">D12 pool split</span>
                <span className="badge">behavioral signals</span>
                <span className="badge">honeypot units</span>
                <span className="badge">operator-key auth</span>
                <span className="badge badge-warn">0 paying customers</span>
                <span className="badge badge-warn">no SOC 2</span>
                <span className="badge badge-warn">no BAA</span>
              </div>
            </div>

            <div>
              <div className="section-eyebrow">who this is for</div>
              <h3 style={{ marginBottom: 16 }}>the wedge</h3>
              <div className="pill-row">
                <span className="badge">indie ticketing</span>
                <span className="badge">paid newsletters</span>
                <span className="badge">DTC shopify (non-plus)</span>
                <span className="badge">seed telemed</span>
                <span className="badge">direct-stripe creators</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        panel · proof of concept ·{' '}
        <a href="https://github.com/UltraInstinct0x/panel" target="_blank" rel="noreferrer">github</a>
        {' · '}
        <Link href="/docs">docs</Link>
        {' · '}
        <Link href="/demo/gate">demo</Link>
      </footer>
    </>
  );
}
