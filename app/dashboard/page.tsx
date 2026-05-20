'use client';
import { useEffect, useState } from 'react';
import Nav from '../_components/Nav';
import { SparkArea, SparkLine, TypeDonut } from '../_components/charts/Charts';
import { StatCard, ChartCard, EmptyState, PulseSkeleton, TypeChip } from '../_components/charts/Cards';
import { fmt, typeColor } from '../_components/charts/util';

const RATER_KEY = 'panel_rater_id';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [series, setSeries] = useState<any>(null);
  const [raterId, setRaterId] = useState<string>('');

  useEffect(() => {
    const rid = typeof window !== 'undefined' ? (window.localStorage.getItem(RATER_KEY) || 'anon') : 'anon';
    setRaterId(rid);
    fetch(`/api/me?rater_id=${rid}`).then(r => r.json()).then(setData);
    fetch(`/api/stats/rater?rater_id=${rid}&limit=14`).then(r => r.json()).then(setSeries);
  }, []);

  const rater = data?.rater;
  const recent = data?.recent ?? [];
  const trajectory = series?.series ?? [];
  const byType: { type: string; judgments: number }[] = series?.by_type ?? [];
  const agreementPct = rater && rater.judgments_count > 0
    ? (rater.agreed_count / rater.judgments_count) * 100
    : 0;

  return (
    <>
      <Nav />
      <div className="dash-container">
        <header className="dash-header">
          <div>
            <h1 className="dash-h1">rater dashboard</h1>
            <div className="dash-sub">rater id: <code>{raterId || '…'}</code> · tier {rater ? tierFor(rater.trust) : '—'}</div>
          </div>
          <div className="dash-actions">
            <a className="btn" href="/demo/gate">judge a unit →</a>
          </div>
        </header>

        {/* row 1: 4 stats */}
        <div className="dash-grid-4">
          {!rater ? (
            <>
              <PulseSkeleton height={96} /><PulseSkeleton height={96} /><PulseSkeleton height={96} /><PulseSkeleton height={96} />
            </>
          ) : (
            <>
              <StatCard label="judgments" value={fmt.int(rater.judgments_count)} sub={<span className="faint">{fmt.int(rater.agreed_count)} matched gold</span>} />
              <StatCard label="trust score" value={fmt.pct1(rater.trust * 100)} sub={<span className="faint">starts at 50.0%</span>} />
              <StatCard label="agreement" value={fmt.pct1(agreementPct)} sub={<span className="faint">lifetime gold match</span>} />
              <StatCard label="earned" value={fmt.dollars(rater.earned_cents)} sub={<span className="faint">{fmt.centsEa(rater.earned_cents / Math.max(1, rater.judgments_count))}</span>} />
            </>
          )}
        </div>

        {/* row 2: trajectory chart */}
        <div className="dash-grid-12">
          <div style={{ gridColumn: 'span 8' }}>
            <ChartCard
              title="agreement trajectory"
              subtitle="rolling 5-judgment agreement % · last 14 judgments"
              right={<span className="faint" style={{ fontSize: 11 }}>now: {series ? fmt.pct1(series.current_trust_pct) : '—'} trust</span>}
              height={280}
            >
              {!series ? <PulseSkeleton height={280} /> :
                trajectory.length === 0 ?
                  <EmptyState message="no data yet — judge 5+ units to see your trust trajectory" /> :
                  <SparkArea data={trajectory} xKey="i" yKey="rolling_pct" color="#7170ff" valueFormatter={(v) => `${Math.round(v)}%`} />
              }
            </ChartCard>
          </div>

          <div style={{ gridColumn: 'span 4' }}>
            <ChartCard title="unit-type mix" subtitle="what you've been judging" height={280}>
              {!series ? <PulseSkeleton height={280} /> :
                byType.length === 0 ?
                  <EmptyState message="no judgments yet" /> :
                  <TypeDonut data={byType} dataKey="judgments" nameKey="type" />
              }
            </ChartCard>
          </div>
        </div>

        {/* type chips legend */}
        {byType.length > 0 && (
          <div className="dash-chip-row">
            {byType.map(t => <TypeChip key={t.type} type={t.type} count={t.judgments} />)}
          </div>
        )}

        {/* row 3: trust trajectory line */}
        <ChartCard title="trust over time" subtitle="how your trust score moves with every judgment" height={180}>
          {!series ? <PulseSkeleton height={180} /> :
            trajectory.length === 0 ?
              <EmptyState message="judge a few units and we'll plot your trust climb" /> :
              <SparkLine data={trajectory} xKey="i" yKey="trust_pct" color="#67e8f9" valueFormatter={(v) => `${Math.round(v)}%`} />
          }
        </ChartCard>

        {/* recent judgments */}
        <div className="dash-card">
          <div className="dash-card-head">
            <div className="dash-card-title">recent judgments</div>
            <div className="dash-card-sub">{fmt.int(recent.length)} shown</div>
          </div>
          {recent.length === 0 ? (
            <EmptyState message="no judgments yet — go judge one →" />
          ) : (
            <table className="dash-table">
              <thead>
                <tr>
                  <th>when</th>
                  <th>unit</th>
                  <th>choice</th>
                  <th className="right">latency</th>
                  <th>gold?</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((j: any) => (
                  <tr key={j.id}>
                    <td className="faint">{new Date(j.created_at).toLocaleTimeString()}</td>
                    <td><code>{j.unit_id}</code></td>
                    <td>{j.choice}</td>
                    <td className="right faint">{fmt.ms(j.latency_ms)}</td>
                    <td>
                      {j.agreed_with_gold === null ? <span className="faint">—</span>
                        : j.agreed_with_gold ? <span className="pill pill-ok">✓ matched</span>
                          : <span className="pill pill-bad">✗ missed</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
