// WS-Q: /admin/operators/[key] — detail + policy editor + audit log.
import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin-auth';
import { getSiteKey } from '@/lib/db';
import { DEFAULT_POLICY } from '@/lib/tier-ladder';
import { recentAuditForKey } from '@/lib/operator-audit';
import { Shell, Card, Chip, Unauthorized, COLORS, FONT } from '../_ui';
import { PolicyEditor, ScrubberToggle } from '../_editor';

export const dynamic = 'force-dynamic';

function maxTierFromPolicy(p: any): 'C1' | 'C2' | 'C3' {
  if (p.t_c2_max >= 1 && p.t_c1_max >= 1) return 'C1';
  if (p.t_c2_max >= 1) return 'C2';
  return 'C3';
}

export default async function OperatorDetailPage({ params }: { params: { key: string } }) {
  const a = await requireAdminPage();
  if (!a.ok) return <Unauthorized />;
  const key = decodeURIComponent(params.key);
  const row = getSiteKey(key);

  if (!row) {
    return (
      <Shell title={key} subtitle="site_key not yet registered">
        <Card>
          <div style={{ color: COLORS.fgDim }}>this site_key has no row in <code style={{ fontFamily: FONT.mono, color: COLORS.cyan }}>site_keys</code>. it will be created on first PUT to policy or settings.</div>
        </Card>
        <BackLink />
      </Shell>
    );
  }

  let policy: any = { ...DEFAULT_POLICY };
  if (row.tier_policy) { try { policy = { ...DEFAULT_POLICY, ...JSON.parse(row.tier_policy) }; } catch {} }
  const maxTier = maxTierFromPolicy(policy);
  const audit = recentAuditForKey(key, 50);

  return (
    <Shell
      title={key}
      subtitle={`registered ${new Date(row.created_at).toISOString().slice(0, 19).replace('T', ' ')} · admin: ${a.admin_key}`}
      right={
        <Link href={`/admin/operators/${encodeURIComponent(key)}/stats`} style={{ color: COLORS.cyan, textDecoration: 'none', fontSize: 12 }}>
          view stats →
        </Link>
      }
    >
      <Card title="ingest config">
        <ScrubberToggle siteKey={key} initial={row.scrubber_required === 1} label={row.label ?? null} />
      </Card>

      <Card title="tier_policy">
        <PolicyEditor siteKey={key} initial={policy} initialMaxTier={maxTier} />
      </Card>

      <Card title={`audit log · last ${audit.length}`}>
        {audit.length === 0 ? (
          <div style={{ color: COLORS.fgDim }}>no changes yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: COLORS.fgFaint }}>
                <Th>ts</Th><Th>event</Th><Th>actor</Th><Th>diff</Th>
              </tr>
            </thead>
            <tbody>
              {audit.map((e: { id: string; event: string; actor: string; ts: number; before: string | null; after: string | null }) => (
                <tr key={e.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <Td><span style={{ fontFamily: FONT.mono, color: COLORS.fgDim }}>{new Date(e.ts).toISOString().slice(0, 19).replace('T', ' ')}</span></Td>
                  <Td><Chip tone={e.event.includes('policy') ? 'cyan' : 'mute'} mono>{e.event}</Chip></Td>
                  <Td><span style={{ fontFamily: FONT.mono }}>{e.actor}</span></Td>
                  <Td>
                    <details>
                      <summary style={{ cursor: 'pointer', color: COLORS.fgDim, fontSize: 11 }}>show</summary>
                      <pre style={{ marginTop: 6, padding: 8, background: '#000', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontFamily: FONT.mono, fontSize: 11, color: COLORS.fg, overflow: 'auto', maxWidth: 600 }}>
{`before: ${e.before ?? 'null'}
after:  ${e.after ?? 'null'}`}
                      </pre>
                    </details>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <BackLink />
    </Shell>
  );
}

function Th(props: { children?: React.ReactNode }) {
  return <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 500 }}>{props.children}</th>;
}
function Td(props: { children?: React.ReactNode }) {
  return <td style={{ padding: '10px 10px', verticalAlign: 'top' }}>{props.children}</td>;
}
function BackLink() {
  return (
    <div style={{ marginTop: 12 }}>
      <Link href="/admin/operators" style={{ color: COLORS.fgDim, fontSize: 12, textDecoration: 'none' }}>← back to operators</Link>
    </div>
  );
}
