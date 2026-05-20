// WS-Q: /admin/operators/[key]/stats — per-route stats, last 7d.
import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin-auth';
import { getSiteKey } from '@/lib/db';
import {
  ingestStats7d,
  challengeStats7d,
  tierDistribution7d,
  latencyStats7d,
  perDayBuckets7d,
} from '@/lib/operator-stats';
import { Shell, Card, Chip, Unauthorized, COLORS, FONT } from '../../_ui';

export const dynamic = 'force-dynamic';

export default function OperatorStatsPage({ params }: { params: { key: string } }) {
  const a = requireAdminPage();
  if (!a.ok) return <Unauthorized />;
  const key = decodeURIComponent(params.key);
  const row = getSiteKey(key);

  const ing = ingestStats7d(key);
  const ch = challengeStats7d(key);
  const tiers = tierDistribution7d(key);
  const lat = latencyStats7d(key);
  const days = perDayBuckets7d(key);

  const passRate = ch.resolved > 0 ? (ch.passed / ch.resolved) : null;
  const tiersTotal = tiers.reduce((s, t) => s + t.n, 0) || 1;

  return (
    <Shell
      title={key}
      subtitle={`stats · last 7 days${row ? '' : ' · (site_key not yet registered)'}`}
      right={
        <Link href={`/admin/operators/${encodeURIComponent(key)}`} style={{ color: COLORS.cyan, textDecoration: 'none', fontSize: 12 }}>
          ← detail
        </Link>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Metric label="ingests" value={ing.ingests} />
        <Metric label="units emitted" value={ing.units_emitted} />
        <Metric label="challenges issued" value={ch.issued} />
        <Metric label="challenges resolved" value={ch.resolved} />
        <Metric label="pass rate" value={passRate === null ? '—' : `${(passRate * 100).toFixed(1)}%`} />
        <Metric label="p50 latency" value={lat.p50_ms === null ? '—' : `${lat.p50_ms} ms`} />
        <Metric label="p99 latency" value={lat.p99_ms === null ? '—' : `${lat.p99_ms} ms`} />
        <Metric label="latency samples" value={lat.n} />
      </div>

      <Card title="tier distribution · 7d (issued challenges)">
        {tiers.length === 0 ? (
          <Empty />
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {tiers.map(t => (
              <div key={t.tier} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 60px', alignItems: 'center', gap: 12 }}>
                <Chip tone="cyan" mono>{t.tier}</Chip>
                <Bar pct={t.n / tiersTotal} />
                <span style={{ fontFamily: FONT.mono, fontSize: 12, color: COLORS.fgDim, textAlign: 'right' }}>{t.n}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="per-day · 7d">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: COLORS.fgFaint }}>
              <Th>day (utc)</Th>
              <Th align="right">ingests</Th>
              <Th align="right">units</Th>
              <Th align="right">challenges</Th>
              <Th align="right">passes</Th>
            </tr>
          </thead>
          <tbody>
            {days.map(d => (
              <tr key={d.day} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                <Td><span style={{ fontFamily: FONT.mono }}>{d.day}</span></Td>
                <Td align="right"><span style={{ fontFamily: FONT.mono }}>{d.ingests}</span></Td>
                <Td align="right"><span style={{ fontFamily: FONT.mono }}>{d.units_emitted}</span></Td>
                <Td align="right"><span style={{ fontFamily: FONT.mono }}>{d.challenges}</span></Td>
                <Td align="right"><span style={{ fontFamily: FONT.mono, color: COLORS.cyan }}>{d.passes}</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Shell>
  );
}

function Metric(props: { label: string; value: number | string }) {
  return (
    <div style={{
      background: COLORS.bg2,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 6,
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: 10, color: COLORS.fgFaint, letterSpacing: 0.5, textTransform: 'uppercase' }}>{props.label}</div>
      <div style={{ fontFamily: FONT.mono, fontSize: 20, color: COLORS.fg, marginTop: 4 }}>{props.value}</div>
    </div>
  );
}

function Bar(props: { pct: number }) {
  return (
    <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(2, props.pct * 100)}%`, height: '100%', background: COLORS.cyan, opacity: 0.8 }} />
    </div>
  );
}

function Empty() {
  return <div style={{ color: COLORS.fgDim, padding: '8px 0' }}>no data in window.</div>;
}

function Th(props: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return <th style={{ padding: '8px 10px', textAlign: props.align ?? 'left', fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 500 }}>{props.children}</th>;
}
function Td(props: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return <td style={{ padding: '8px 10px', textAlign: props.align ?? 'left' }}>{props.children}</td>;
}
