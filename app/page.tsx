'use client';

import Link from 'next/link';
import Nav from './_components/Nav';

const SDK_SNIPPET = `import { createClient } from 'panel-sdk';

const panel = createClient({ siteKey: process.env.PANEL_KEY!, secret: process.env.PANEL_SECRET! });
await panel.emitProcessOutput({ kind: 'reply', content: agentReply, context: prompt });`;

export default function Home() {
  const copy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(SDK_SNIPPET).catch(() => {});
    }
  };

  return (
    <>
      <Nav />

      {/* HERO */}
      <section className="hero">
        <div className="container">
          <span className="hero-eyebrow">live now · shipping weekly</span>
          <h1>proof-of-humanity that produces signal.</h1>
          <p className="hero-sub">
            three layers. one rater pool. visitors solve a taste captcha (L1),
            operators ship agent outputs for humans to judge (L2), domain experts
            review the high-stakes stuff (L3). the work is the proof. the proof is the dataset.
          </p>
          <div className="hero-ctas">
            <Link href="/how-it-works" className="btn btn-primary">how it works</Link>
            <Link href="/demo/c0-c3" className="btn">try the gate</Link>
            <a href="#emitter" className="btn btn-ghost">see the sdk</a>
          </div>

          <div className="live-frame">
            <div className="live-iframe-wrap">
              <iframe src="/embed" loading="lazy" title="L1: live taste captcha" />
            </div>
            <div className="live-caption">
              <span className="live-dot" />
              L1 live · running now
            </div>
          </div>
        </div>
      </section>

      {/* LADDER */}
      <section className="section" id="ladder">
        <div className="container">
          <div className="section-eyebrow">the ladder</div>
          <h2 className="section-title">three layers of human signal, one shared rater pool.</h2>
          <p className="section-sub">
            captcha at the bottom, expert review at the top. raters move up the ladder
            as their trust score goes up. operators pick the layer that matches their stakes.
          </p>

          <div className="grid-3">
            <div className="step-card">
              <div className="step-num">L1 · taste captcha</div>
              <div className="step-title">replaces recaptcha &amp; turnstile.</div>
              <p className="step-body">
                visitors prove they&apos;re human by judging one piece of agent output —
                pick the better headline, flag the off-sync dub, rank a vs b.
                three seconds, taste/aesthetic friction, &apos;solve&apos; verb.
                the answer is the proof. the proof becomes a labelled row.
              </p>
            </div>
            <div className="step-card">
              <div className="step-num">L2 · agent-output rating</div>
              <div className="step-title">b2b feedback loop for agent stacks.</div>
              <p className="step-body">
                operators emit agent outputs, skill diffs, process outputs.
                trusted raters &apos;judge&apos; them — pairwise, rubric, free-form.
                preference rows flow back to the operator, signed, deduped, scored.
                the loop closes without a labelling vendor in the middle.
              </p>
            </div>
            <div className="step-card">
              <div className="step-num">L3 · expert review</div>
              <div className="step-title">domain specialists for high-stakes signal.</div>
              <p className="step-body">
                regulated pros, medical, legal, trades. credentialed reviewers
                gated behind verification. paid per unit, audit trail per row.
                for outputs where a wrong rating costs more than the rating.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WEDGE */}
      <section className="section">
        <div className="container">
          <div className="section-eyebrow">the wedge</div>
          <h2 className="section-title">recaptcha extracts free training data. panel routes signal to operators who pay raters.</h2>
          <p className="section-sub">
            same friction, opposite economics. every captcha solve is a labelled row —
            the only question is who owns it.
          </p>

          <div className="grid-2" style={{ marginTop: 32 }}>
            <div className="card">
              <h4 style={{ marginBottom: 12 }}>recaptcha · turnstile</h4>
              <p className="step-body" style={{ marginBottom: 8 }}>
                visitors label google&apos;s self-driving data for free.
              </p>
              <p className="step-body" style={{ marginBottom: 8 }}>
                operator gets a yes/no token. the dataset goes to mountain view.
              </p>
              <p className="step-body" style={{ margin: 0 }}>
                rater compensation: zero.
              </p>
            </div>
            <div className="card" style={{ borderColor: 'rgba(103,232,249,0.3)' }}>
              <h4 style={{ marginBottom: 12, color: 'var(--accent)' }}>panel</h4>
              <p className="step-body" style={{ marginBottom: 8 }}>
                visitors judge the operator&apos;s own agent output.
              </p>
              <p className="step-body" style={{ marginBottom: 8 }}>
                operator gets a yes/no token <em>and</em> the labelled row.
              </p>
              <p className="step-body" style={{ margin: 0 }}>
                rater compensation: balance accrues. paid-train coming.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* EMITTER PIPELINE */}
      <section className="section" id="emitter">
        <div className="container">
          <div className="section-eyebrow">emitter pipeline</div>
          <h2 className="section-title">three lines. no hmac dance.</h2>
          <p className="section-sub">
            the sdk handles signing, batching, and the ingest contract.
            operators emit. adapters fan out. raters judge. signal returns.
          </p>

          <div className="code-wrap" style={{ marginBottom: 32 }}>
            <div className="code-wrap-head">
              <span>panel-sdk · typescript</span>
              <button className="copy-btn" onClick={copy}>copy</button>
            </div>
            <pre>{SDK_SNIPPET}</pre>
          </div>

          <div className="grid-3">
            <div className="step-card">
              <div className="step-num">shipping</div>
              <div className="step-title">modal dev-gen</div>
              <p className="step-body">
                serverless agent runners emit process outputs straight from the function.
                hmac-signed in the worker, no proxy.
              </p>
            </div>
            <div className="step-card">
              <div className="step-num">incoming · v6b</div>
              <div className="step-title">comfyui · replicate</div>
              <p className="step-body">
                image/video generation pipelines. webhook adapter writes media_origin
                + media_quality units on completion.
              </p>
            </div>
            <div className="step-card">
              <div className="step-num">incoming · v6c</div>
              <div className="step-title">elevenlabs</div>
              <p className="step-body">
                tts/voice clone outputs into dub-sync and naturalness rating units.
                same emit shape, different rubric.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PAID-TRAIN LOOP */}
      <section className="section">
        <div className="container">
          <div className="section-eyebrow">paid-train loop</div>
          <h2 className="section-title">rater balance → tokens → finetune → deploy.</h2>
          <p className="section-sub" style={{ maxWidth: 720 }}>
            raters earn by judging. balances convert to inference credits and finetune
            runs against the dataset they helped label. operators close the loop on the
            same surface that produced it — judge, train, deploy, judge again. no
            data-broker, no labelling vendor, no separate gpu account.
          </p>
          <div className="hero-ctas" style={{ marginTop: 24, justifyContent: 'flex-start' }}>
            <Link href="/how-it-works" className="btn btn-primary">see the full loop</Link>
            <Link href="/pricing" className="btn btn-ghost">pricing</Link>
          </div>
        </div>
      </section>

      {/* WHERE IT IS TODAY */}
      <section className="section">
        <div className="container">
          <div className="grid-2">
            <div>
              <div className="section-eyebrow">where it is today</div>
              <h3 style={{ marginBottom: 16 }}>shipped now</h3>
              <div className="pill-row">
                <span className="badge">L1 live · /embed</span>
                <span className="badge">persistent sqlite</span>
                <span className="badge">trust-pool routing</span>
                <span className="badge">behavioral signals</span>
                <span className="badge">honeypot units</span>
                <span className="badge">operator-key auth</span>
                <span className="badge">panel-sdk · ts</span>
                <span className="badge">modal dev-gen adapter</span>
                <span className="badge badge-warn">no paid-train yet</span>
                <span className="badge badge-warn">no SOC 2</span>
              </div>
            </div>

            <div>
              <div className="section-eyebrow">try it</div>
              <h3 style={{ marginBottom: 16 }}>live surfaces</h3>
              <div className="pill-row">
                <Link href="/demo/c0-c3" className="badge badge-accent">demo · c0-c3 gate</Link>
                <Link href="/embed" className="badge badge-accent">L1 widget</Link>
                <Link href="/onboard" className="badge badge-accent">operator onboard</Link>
                <Link href="/dashboard" className="badge">dashboard</Link>
                <Link href="/operator" className="badge">operator console</Link>
                <Link href="/docs" className="badge">docs</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        panel · open build ·{' '}
        <a href="https://github.com/UltraInstinct0x/panel" target="_blank" rel="noreferrer">github</a>
        {' · '}
        <Link href="/how-it-works">how it works</Link>
        {' · '}
        <Link href="/docs">docs</Link>
        {' · '}
        <Link href="/demo/c0-c3">demo</Link>
        {' · '}
        <Link href="/privacy">privacy</Link>
        {' · '}
        <Link href="/terms">terms</Link>
      </footer>
    </>
  );
}
