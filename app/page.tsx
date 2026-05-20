import Link from 'next/link';
import Nav from './_components/Nav';

export default function Home() {
  return (
    <>
      <Nav />
      <div className="container">
        <h1>panel</h1>
        <p className="muted">captcha-shaped feedback layer for agent outputs. visitors prove they&apos;re human by judging one tiny piece of agent work. operators get a captcha. agent stacks get continuous preference data.</p>

        <hr />

        <h3>demo surfaces</h3>
        <div className="grid-2">
          <Link href="/demo/gate" className="card" style={{ borderColor: 'var(--accent)' }}>
            <div className="row-between">
              <strong>/demo/gate</strong>
              <span className="badge badge-accent">start here</span>
            </div>
            <p className="muted" style={{ margin: '8px 0 0' }}>a fake signup form embedding the panel widget as a captcha. judge one unit, get through.</p>
          </Link>

          <Link href="/widget?embed=true" className="card">
            <div className="row-between">
              <strong>/widget</strong>
              <span className="badge">embeddable</span>
            </div>
            <p className="muted" style={{ margin: '8px 0 0' }}>the widget itself. iframe-able. served standalone for SDK preview.</p>
          </Link>

          <Link href="/dashboard" className="card">
            <div className="row-between">
              <strong>/dashboard</strong>
              <span className="badge">rater view</span>
            </div>
            <p className="muted" style={{ margin: '8px 0 0' }}>your recent judgments + trust score + earnings (mock).</p>
          </Link>

          <Link href="/operator" className="card">
            <div className="row-between">
              <strong>/operator</strong>
              <span className="badge">operator view</span>
            </div>
            <p className="muted" style={{ margin: '8px 0 0' }}>embed code, traffic, dataset preview, attestation envelope.</p>
          </Link>
        </div>

        <hr />

        <h3>five unit types in the pool</h3>
        <ul className="muted">
          <li><strong>pairwise trace</strong> — which agent run looks better for this prompt?</li>
          <li><strong>step validity</strong> — does this single tool call make sense given the goal?</li>
          <li><strong>skill diff vote</strong> — is this proposed skill edit an improvement?</li>
          <li><strong>hallucination flag</strong> — does this claim look fabricated?</li>
          <li><strong>taste rank</strong> — rank these N outputs by quality.</li>
        </ul>

        <hr />

        <h3>under the hood</h3>
        <p className="muted">in-memory store, no database. seed pool of ~30 mock units. trust score is a toy ELO-shaped number that moves on agreement with the (mock) gold set. <strong>none of this is the real system</strong> — it&apos;s the shape of the user-facing surfaces so you can feel the loop. real backend lives in the private design vault.</p>

        <p className="faint" style={{ marginTop: 32, fontSize: 11 }}>panel · proof of concept · <a href="https://github.com/UltraInstinct0x/panel">github</a></p>
      </div>
    </>
  );
}
