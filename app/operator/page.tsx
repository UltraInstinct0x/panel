'use client';
import { useEffect, useState } from 'react';
import Nav from '../_components/Nav';

export default function OperatorPage() {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => { fetch('/api/stats').then(r => r.json()).then(setStats); }, []);

  return (
    <>
      <Nav />
      <div className="container">
        <h1>operator dashboard</h1>
        <p className="muted">embedding panel on $FAKE_PRODUCT. live stats from the demo pool.</p>

        {!stats ? <p className="muted">loading…</p> : (
          <div className="grid-2" style={{ marginTop: 16 }}>
            <div className="card stat">
              <div className="stat-label">units in pool</div>
              <div className="stat-n">{stats.total_units}</div>
            </div>
            <div className="card stat">
              <div className="stat-label">judgments collected</div>
              <div className="stat-n">{stats.total_judgments}</div>
            </div>
            <div className="card stat">
              <div className="stat-label">raters</div>
              <div className="stat-n">{stats.total_raters}</div>
            </div>
            <div className="card stat">
              <div className="stat-label">avg rater trust</div>
              <div className="stat-n">{(stats.avg_trust * 100).toFixed(1)}%</div>
            </div>
          </div>
        )}

        <h3 style={{ marginTop: 32 }}>embed code</h3>
        <pre>{`<!-- 1. drop this in your <head> -->
<script src="https://panel.goku.codes/sdk.js" async></script>

<!-- 2. drop this where you want the captcha -->
<div data-panel-site="YOUR_SITE_KEY"
     data-panel-callback="onPanelSolved"></div>

<!-- 3. handle the verification token -->
<script>
  function onPanelSolved(token) {
    // POST token to your backend, verify with panel API
    document.getElementById('signup-form').submit();
  }
</script>`}</pre>

        <h3 style={{ marginTop: 32 }}>attestation envelope (per verification)</h3>
        <p className="muted">every panel verification ships with this envelope. proves the rater path is clean and the trace was scrubber-proxied before display.</p>
        <pre>{`{
  "token": "pnl_v1_${Math.random().toString(36).slice(2, 24)}",
  "issued_at": "${new Date().toISOString()}",
  "site_key": "YOUR_SITE_KEY",
  "rater": {
    "trust": 0.73,
    "tier": "T2",
    "behavioral_score": 0.91
  },
  "unit": {
    "id": "u_pair_001",
    "type": "pairwise_trace",
    "source_agent": "opencode/atlas",
    "scrubber_attestation": {
      "service": "scrubber-proxy@v0.3.2",
      "rules_version": "compliance/gdpr-2026.05",
      "redactions": ["pii.email", "pii.ipv4"],
      "passed": true
    }
  },
  "judgment_summary": {
    "agreed_with_pool": true,
    "latency_ms": 4280
  }
}`}</pre>

        <h3 style={{ marginTop: 32 }}>recent judgments (all raters)</h3>
        {stats?.recent_judgments?.length ? (
          <table>
            <thead><tr><th>when</th><th>rater</th><th>unit</th><th>choice</th><th>gold?</th></tr></thead>
            <tbody>
              {stats.recent_judgments.map((j: any) => (
                <tr key={j.id}>
                  <td className="faint">{new Date(j.created_at).toLocaleTimeString()}</td>
                  <td><code>{j.rater_id}</code></td>
                  <td><code>{j.unit_id}</code></td>
                  <td>{j.choice}</td>
                  <td>{j.agreed_with_gold === null ? '—' : j.agreed_with_gold ? '✓' : '✗'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">no judgments collected yet.</p>}
      </div>
    </>
  );
}
