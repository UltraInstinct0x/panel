'use client';
import { useState } from 'react';
import Nav from '../../_components/Nav';
import Widget from '../../_components/Widget';

export default function GatePage() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [verified, setVerified] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <>
        <Nav />
        <div className="container-narrow" style={{ marginTop: 80, textAlign: 'center' }}>
          <h1>account created.</h1>
          <p className="muted">(not really — this is a demo)</p>
          <p className="muted">but the panel judgment you made was real. it&apos;s in the dataset.</p>
          <p style={{ marginTop: 24 }}><a href="/dashboard">see your rater dashboard →</a></p>
        </div>
      </>
    );
  }

  return (
    <>
      <Nav />
      <div className="container-narrow">
        <h1>sign up for $FAKE_PRODUCT</h1>
        <p className="muted">a fake operator. their signup form embeds panel as a captcha. you&apos;ll judge one piece of agent work below to prove you&apos;re human.</p>

        <div className="gate">
          <label>email</label>
          <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          <label>password</label>
          <input type="password" placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} />

          <div style={{ marginTop: 20 }}>
            <Widget siteKey="pk_demo_a" onSolved={() => setVerified(true)} />
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 16 }}
            disabled={!verified || !email || !pw}
            onClick={() => setSubmitted(true)}
          >
            {verified ? 'create account →' : 'judge a unit to continue'}
          </button>

          <div className="faint" style={{ marginTop: 12, fontSize: 11, textAlign: 'center' }}>
            powered by <a href="/" style={{ color: 'var(--fg-faint)' }}>panel</a> · the operator pays $0.05/verification
          </div>
        </div>
      </div>
    </>
  );
}
