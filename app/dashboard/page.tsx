'use client';
import { useEffect, useState } from 'react';
import Nav from '../_components/Nav';

const RATER_KEY = 'panel_rater_id';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [raterId, setRaterId] = useState<string>('');

  useEffect(() => {
    const rid = typeof window !== 'undefined' ? (window.localStorage.getItem(RATER_KEY) || 'anon') : 'anon';
    setRaterId(rid);
    fetch(`/api/me?rater_id=${rid}`).then(r => r.json()).then(setData);
  }, []);

  if (!data) return (<><Nav /><div className="container"><p className="muted">loading…</p></div></>);
  const { rater, recent } = data;

  return (
    <>
      <Nav />
      <div className="container">
        <h1>rater dashboard</h1>
        <p className="muted">rater id: <code>{raterId}</code></p>

        <div className="grid-2" style={{ marginTop: 16 }}>
          <div className="card stat">
            <div className="stat-label">trust score</div>
            <div className="stat-n">{(rater.trust * 100).toFixed(1)}%</div>
            <div className="faint" style={{ fontSize: 11 }}>starts at 50%. moves with gold agreement.</div>
          </div>
          <div className="card stat">
            <div className="stat-label">judgments</div>
            <div className="stat-n">{rater.judgments_count}</div>
            <div className="faint" style={{ fontSize: 11 }}>{rater.agreed_count} matched gold</div>
          </div>
          <div className="card stat">
            <div className="stat-label">earned</div>
            <div className="stat-n">${(rater.earned_cents / 100).toFixed(2)}</div>
            <div className="faint" style={{ fontSize: 11 }}>1¢/judgment + 2¢ on agreement (demo rates)</div>
          </div>
          <div className="card stat">
            <div className="stat-label">tier</div>
            <div className="stat-n">{tierFor(rater.trust)}</div>
            <div className="faint" style={{ fontSize: 11 }}>unlocks higher-paying units</div>
          </div>
        </div>

        <h3 style={{ marginTop: 32 }}>recent judgments</h3>
        {recent.length === 0 ? (
          <p className="muted">no judgments yet. <a href="/demo/gate">go judge one →</a></p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>when</th>
                <th>unit</th>
                <th>your choice</th>
                <th>latency</th>
                <th>matched gold?</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((j: any) => (
                <tr key={j.id}>
                  <td className="faint">{new Date(j.created_at).toLocaleTimeString()}</td>
                  <td><code>{j.unit_id}</code></td>
                  <td>{j.choice}</td>
                  <td className="faint">{(j.latency_ms / 1000).toFixed(1)}s</td>
                  <td>{j.agreed_with_gold === null ? '—' : j.agreed_with_gold ? <span className="badge badge-ok">✓</span> : <span className="badge badge-danger">✗</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function tierFor(t: number): string {
  if (t < 0.4) return 'T0 · probation';
  if (t < 0.6) return 'T1 · standard';
  if (t < 0.8) return 'T2 · trusted';
  return 'T3 · expert';
}
