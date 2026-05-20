import type { Metadata } from 'next';
import Link from 'next/link';
import Nav from '../_components/Nav';

export const metadata: Metadata = {
  title: 'panel — how it works',
  description: 'ladder → emitter → marketplace loop. three layers of human signal, one shared rater pool, an sdk that fans out into adapters.',
};

const DIAGRAM = `   operator stack                        panel surface                 raters
   ─────────────                         ─────────────                 ──────
   agent / model ──┐
                   │  emitMedia()
   modal worker ───┤  emitProcessOutput()        ┌── L1 · taste captcha ──┐
                   ├─────────────────►  panel  ──┤   (any visitor, gated) │──┐
   comfyui  ──────┤  panel-sdk        ingest      │                        │  │
   replicate ─────┤  hmac · batch     api         ├── L2 · agent rating ───┤  │  judgments
   elevenlabs ────┘                                │   (trusted raters)     │  ├──────────►
                                                   │                        │  │
                                                   └── L3 · expert review ──┘  │
                                                                               │
                                       ◄──── signed preference rows ──────────┘
                                       ◄──── rater balance ledger
                                            (paid-train · coming)
`;

export default function HowItWorks() {
  return (
    <>
      <Nav />

      <section className="section">
        <div className="container-narrow">
          <div className="section-eyebrow">how it works</div>
          <h1 style={{ fontSize: 44, lineHeight: 1.1, letterSpacing: '-0.88px', marginBottom: 16 }}>
            ladder → emitter → marketplace loop.
          </h1>
          <p className="hero-sub" style={{ margin: '0 0 32px', textAlign: 'left' }}>
            panel is a captcha-shaped feedback layer. the friction is the dataset.
            operators emit, raters judge, signal returns. one rater pool, three layers,
            one sdk.
          </p>

          <div className="code-wrap" style={{ marginBottom: 48 }}>
            <div className="code-wrap-head">
              <span>the loop</span>
            </div>
            <pre style={{ fontSize: 12, lineHeight: 1.5 }}>{DIAGRAM}</pre>
          </div>

          <h2 className="section-title">1 · ladder</h2>
          <p>
            three layers of human signal, one shared rater pool. trust scores
            propagate up — raters that handle L1 cleanly get promoted to L2, L2
            performers with verified credentials get gated into L3.
          </p>
          <ul style={{ color: 'var(--fg-dim)', paddingLeft: 20, lineHeight: 1.7 }}>
            <li><strong style={{ color: 'var(--fg)' }}>L1 — taste captcha.</strong> drop-in replacement for recaptcha/turnstile. visitors solve a 3-second taste judgment. operator gets a verification token <em>and</em> a labelled row.</li>
            <li><strong style={{ color: 'var(--fg)' }}>L2 — agent-output rating.</strong> trusted raters judge agent outputs, skill diffs, process traces. pairwise, rubric, free-form. preference data flows back to the operator stack.</li>
            <li><strong style={{ color: 'var(--fg)' }}>L3 — expert review.</strong> credentialed domain reviewers for high-stakes outputs. medical, legal, regulated trades. paid per unit, audit trail per row.</li>
          </ul>

          <h2 className="section-title" style={{ marginTop: 48 }}>2 · emitter</h2>
          <p>
            <code>panel-sdk</code> is the operator side. it handles hmac signing,
            batching, retries, and the ingest contract. adapters wrap common
            generation surfaces so operators don&apos;t have to wire a webhook
            from scratch.
          </p>
          <ul style={{ color: 'var(--fg-dim)', paddingLeft: 20, lineHeight: 1.7 }}>
            <li>modal dev-gen — shipping. emit from inside the worker.</li>
            <li>comfyui · replicate — incoming via v6b. webhook adapter for image/video.</li>
            <li>elevenlabs — incoming via v6c. tts/voice into dub-sync rubric.</li>
            <li>raw escape hatch — <code>emitRaw(units)</code> for anything else.</li>
          </ul>

          <h2 className="section-title" style={{ marginTop: 48 }}>3 · marketplace loop</h2>
          <p>
            raters earn balance per accepted unit. balance converts to inference
            credits and finetune runs against the dataset they helped label. the
            operator that paid for the rating uses the resulting model on the same
            surface that produced the data. no broker in between.
          </p>
          <p>
            paid-train is private alpha. <a href="mailto:g_guney@icloud.com?subject=panel%20paid-train%20access">request access</a>.
          </p>

          <hr />

          <div className="hero-ctas" style={{ justifyContent: 'flex-start', marginTop: 24 }}>
            <Link href="/demo/c0-c3" className="btn btn-primary">try the gate</Link>
            <Link href="/onboard" className="btn">apply as operator</Link>
            <Link href="/" className="btn btn-ghost">back</Link>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        panel · proof of concept ·{' '}
        <a href="https://github.com/UltraInstinct0x/panel" target="_blank" rel="noreferrer">github</a>
        {' · '}
        <Link href="/">home</Link>
      </footer>
    </>
  );
}
