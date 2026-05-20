'use client';
import { useEffect, useMemo, useState } from 'react';
import Nav from '../_components/Nav';
import { SparkArea, TypeDonut, TrustBars } from '../_components/charts/Charts';
import { StatCard, ChartCard, EmptyState, PulseSkeleton, TypeChip } from '../_components/charts/Cards';
import { fmt, typeColor } from '../_components/charts/util';

const SITE_KEY_LS = 'panel_operator_site_key';

export default function OperatorPage() {
  const [stats, setStats] = useState<any>(null);
  const [series, setSeries] = useState<any>(null);
  const [types, setTypes] = useState<any>(null);
  const [siteKey, setSiteKey] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats);
    fetch('/api/stats/series?window=7d').then(r => r.json()).then(setSeries);
    fetch('/api/stats/types').then(r => r.json()).then(setTypes);
    if (typeof window !== 'undefined') {
      const k = window.localStorage.getItem(SITE_KEY_LS);
      if (k) setSiteKey(k);
    }
  }, []);

  const generateKey = () => {
    const k = `sk_live_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    setSiteKey(k);
    if (typeof window !== 'undefined') window.localStorage.setItem(SITE_KEY_LS, k);
  };
  const copyKey = async () => {
    if (!siteKey) return;
    try { await navigator.clipboard.writeText(siteKey); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
  };

  const recent = stats?.recent_judgments ?? [];
  const seriesData = series?.series ?? [];
  const types7 = types?.by_type ?? [];

  // 14-day window total for headline deltas
  const last7 = useMemo(() => seriesData.reduce((s: number, p: any) => s + (p.judgments || 0), 0), [seriesData]);
  const prior7 = 0; // we only have 1 window today; honesty: no prior comparison yet
  const trafficDelta = prior7 > 0 ? ((last7 - prior7) / prior7) * 100 : 0;

  return (
    <>
      <Nav />
      <div className="dash-container">
        <header className="dash-header">
          <div>
            <h1 className="dash-h1">operator console</h1>
            <div className="dash-sub">live dataset · panel.goku.codes · last 7 days</div>
          </div>
          <div className="dash-actions">
            <span className="status-dot" /> live
            <a className="btn" href="/widget?embed=true" target="_blank" rel="noreferrer">preview widget ↗</a>
          </div>
        </header>

        {/* row 1: 4 headline stats */}
        <div className="dash-grid-4">
          {!stats ? (
            <>
              <PulseSkeleton height={108} /><PulseSkeleton height={108} /><PulseSkeleton height={108} /><PulseSkeleton height={108} />
            </>
          ) : (
            <>
              <StatCard
                label="challenges served"
                value={fmt.int(stats.total_judgments)}
                sub={<span className="faint">across {fmt.int(stats.total_raters)} raters</span>}
              />
              <StatCard
                label="solve rate"
                value={fmt.pct1(stats.solve_rate_pct)}
                sub={<span className="faint">non-honeypot completions</span>}
              />
              <StatCard
                label="avg solve time"
                value={fmt.ms(stats.avg_latency_ms)}
                sub={<span className="faint">last 500 judgments</span>}
              />
              <StatCard
                label="bot-flag rate"
                value={fmt.pct1(stats.bot_flag_rate_pct)}
                sub={<span className="faint">{fmt.int(stats.honeypot_failures)} honeypot fails / {fmt.int(stats.honeypot_units)} seeded</span>}
              />
            </>
          )}
        </div>

        {/* row 2: traffic + type-mix */}
        <div className="dash-grid-12">
          <div style={{ gridColumn: 'span 8' }}>
            <ChartCard
              title="challenge traffic"
              subtitle="daily judgments · last 7 days · UTC"
              right={<span className="faint" style={{ fontSize: 11 }}>{fmt.int(last7)} this window</span>}
              height={280}
            >
              {!series ? <PulseSkeleton height={280} /> :
                seriesData.every((p: any) => p.judgments === 0) ?
                  <EmptyState message="no traffic in the last 7 days — embed the widget to start collecting" /> :
                  <SparkArea data={seriesData} xKey="date" yKey="judgments" color="#7170ff" valueFormatter={(v) => fmt.int(v)} />
              }
            </ChartCard>
          </div>

          <div style={{ gridColumn: 'span 4' }}>
            <ChartCard title="unit-type distribution" subtitle="dataset composition" height={280}>
              {!types ? <PulseSkeleton height={280} /> :
                types7.length === 0 ?
                  <EmptyState message="no units in pool" /> :
                  <TypeDonut data={types7} dataKey="judgments" nameKey="type" />
              }
            </ChartCard>
          </div>
        </div>

        {/* type chip legend with counts */}
        {types7.length > 0 && (
          <div className="dash-chip-row">
            {types7.map((t: any) => <TypeChip key={t.type} type={t.type} count={t.judgments} />)}
          </div>
        )}

        {/* row 3: agreement-rate area + trust-distribution bars */}
        <div className="dash-grid-12">
          <div style={{ gridColumn: 'span 7' }}>
            <ChartCard
              title="captcha quality"
              subtitle="daily gold-agreement % · proxy for dataset trust"
              right={<span className="faint" style={{ fontSize: 11 }}>lifetime: {stats ? fmt.pct1(stats.captcha_quality_pct) : '—'}</span>}
              height={240}
            >
              {!series ? <PulseSkeleton height={240} /> :
                seriesData.every((p: any) => p.agreement_pct === null) ?
                  <EmptyState message="not enough scored judgments yet" /> :
                  <SparkArea
                    data={seriesData.map((p: any) => ({ ...p, agreement_pct_v: p.agreement_pct ?? 0 }))}
                    xKey="date" yKey="agreement_pct_v" color="#67e8f9"
                    valueFormatter={(v) => `${Math.round(v)}%`}
                  />
              }
            </ChartCard>
          </div>

          <div style={{ gridColumn: 'span 5' }}>
            <ChartCard
              title="rater trust distribution"
              subtitle={`${stats ? fmt.int(stats.total_raters) : '—'} raters · avg ${stats ? fmt.pct1(stats.avg_trust * 100) : '—'}`}
              height={240}
            >
              {!stats ? <PulseSkeleton height={240} /> :
                (stats.trust_distribution ?? []).every((b: any) => b.raters === 0) ?
                  <EmptyState message="no raters in pool yet" /> :
                  <TrustBars data={stats.trust_distribution} />
              }
            </ChartCard>
          </div>
        </div>

        {/* dataset preview */}
        <div className="dash-card">
          <div className="dash-card-head">
            <div>
              <div className="dash-card-title">dataset preview</div>
              <div className="dash-card-sub">most recent 10 judgments — sampled across all raters</div>
            </div>
            <span className="faint" style={{ fontSize: 11 }}>export → ndjson, parquet (coming soon)</span>
          </div>
          {recent.length === 0 ? (
            <EmptyState message="no judgments collected yet" />
          ) : (
            <table className="dash-table">
              <thead>
                <tr>
                  <th>when</th>
                  <th>rater</th>
                  <th>unit</th>
                  <th>type</th>
                  <th>choice</th>
                  <th>agreed</th>
                  <th className="right">dwell</th>
                </tr>
              </thead>
              <tbody>
                {recent.slice(0, 10).map((j: any) => (
                  <tr key={j.id}>
                    <td className="faint">{new Date(j.created_at).toLocaleTimeString()}</td>
                    <td><code>{j.rater_id.slice(0, 12)}</code></td>
                    <td><code>{j.unit_id}</code></td>
                    <td><RowTypeChip unitId={j.unit_id} /></td>
                    <td>{trim(j.choice, 24)}</td>
                    <td>
                      {j.agreed_with_gold === null ? <span className="faint">—</span>
                        : j.agreed_with_gold ? <span className="pill pill-ok">Y</span>
                          : <span className="pill pill-bad">N</span>}
                      {j.honeypot_failed && <span className="pill pill-warn" style={{ marginLeft: 6 }}>bot</span>}
                    </td>
                    <td className="right faint">{fmt.ms(j.latency_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* site key management */}
        <div className="dash-grid-12">
          <div style={{ gridColumn: 'span 7' }}>
            <div className="dash-card">
              <div className="dash-card-head">
                <div>
                  <div className="dash-card-title">site key</div>
                  <div className="dash-card-sub">use this on your <code>&lt;script&gt;</code> embed</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn" onClick={generateKey}>{siteKey ? 'rotate' : 'generate'}</button>
                  <button className="btn" onClick={copyKey} disabled={!siteKey}>{copied ? 'copied ✓' : 'copy'}</button>
                </div>
              </div>
              <div className="key-row">
                <code className="key-mono">{siteKey || '— no key yet — click generate —'}</code>
              </div>
              <div className="faint" style={{ fontSize: 11, marginTop: 8 }}>
                key is stored locally for this demo. in production: rotate via dashboard, scope per domain, audit per request.
              </div>
            </div>
          </div>

          <div style={{ gridColumn: 'span 5' }}>
            <div className="dash-card">
              <div className="dash-card-head">
                <div>
                  <div className="dash-card-title">embed snippet</div>
                  <div className="dash-card-sub">drop in <code>&lt;head&gt;</code></div>
                </div>
              </div>
              <pre className="embed-pre">{`<script src="https://panel.goku.codes/sdk.js" async></script>
<div data-panel-site="${siteKey || 'YOUR_SITE_KEY'}"
     data-panel-callback="onPanelSolved"></div>`}</pre>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function trim(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// renders a type chip for a row — looks up unit type heuristically from the unit_id
// (we don't get type back in the recent_judgments payload). harmless when unknown.
function RowTypeChip({ unitId }: { unitId: string }) {
  // unit_ids in seeds follow `u_<type>_NNN` patterns — best-effort parse
  const m = /^u_([a-z]+)_/i.exec(unitId);
  const t = m ? m[1] : 'unit';
  return <TypeChip type={t} />;
}
