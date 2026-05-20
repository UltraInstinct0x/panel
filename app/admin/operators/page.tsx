// WS-Q: /admin/operators — list view.
import { requireAdminPage } from '@/lib/admin-auth';
import {
  listAllSiteKeys,
  ingestCount,
  challengeCount,
} from '@/lib/operator-stats';
import { DEFAULT_POLICY } from '@/lib/tier-ladder';
import Link from 'next/link';
import { Shell, Card, Chip, Unauthorized, COLORS, FONT } from './_ui';

export const dynamic = 'force-dynamic';

export default function OperatorsPage() {
  const a = requireAdminPage();
  if (!a.ok) return <Unauthorized />;
  const rows = listAllSiteKeys();
  return (
    <Shell title="operators" subtitle={`${rows.length} registered site_key${rows.length === 1 ? '' : 's'} · stats window: last 7 days`}>
      <Card>
        {rows.length === 0 ? (
          <div style={{ color: COLORS.fgDim, padding: '20px 4px' }}>no site_keys yet. they appear on first ingest, or seed via <code style={{ fontFamily: FONT.mono, color: COLORS.cyan }}>upsertSiteKey()</code>.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: COLORS.fgFaint, fontWeight: 500 }}>
                <Th>site_key</Th>
                <Th>label</Th>
                <Th>scrubber</Th>
                <Th>min_trust</Th>
                <Th align="right">ingests · 7d</Th>
                <Th align="right">challenges · 7d</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                let pol: any = { ...DEFAULT_POLICY };
                if (r.tier_policy) { try { pol = { ...DEFAULT_POLICY, ...JSON.parse(r.tier_policy) }; } catch {} }
                const ing = ingestCount(r.site_key, 7);
                const ch = challengeCount(r.site_key, 7);
                return (
                  <tr key={r.site_key} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <Td><span style={{ fontFamily: FONT.mono, color: COLORS.cyan }}>{r.site_key}</span></Td>
                    <Td><span style={{ color: COLORS.fg }}>{r.label || <span style={{ color: COLORS.fgFaint }}>—</span>}</span></Td>
                    <Td>
                      {r.scrubber_required ? <Chip tone="cyan">required</Chip> : <Chip tone="amber">carve-out</Chip>}
                    </Td>
                    <Td><span style={{ fontFamily: FONT.mono }}>{pol.min_trust.toFixed(2)}</span></Td>
                    <Td align="right"><span style={{ fontFamily: FONT.mono }}>{ing}</span></Td>
                    <Td align="right"><span style={{ fontFamily: FONT.mono }}>{ch}</span></Td>
                    <Td align="right">
                      <Link href={`/admin/operators/${encodeURIComponent(r.site_key)}`} style={{ color: COLORS.cyan, textDecoration: 'none' }}>configure →</Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </Shell>
  );
}

function Th(props: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return <th style={{ padding: '8px 10px', textAlign: props.align ?? 'left', fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' }}>{props.children}</th>;
}
function Td(props: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return <td style={{ padding: '10px 10px', textAlign: props.align ?? 'left', verticalAlign: 'middle' }}>{props.children}</td>;
}
