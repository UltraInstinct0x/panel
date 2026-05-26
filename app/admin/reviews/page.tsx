// /admin/reviews — operator-side queue of skill-diff review units.
// Shows pending units sorted by oldest, verdict counts, link to public verdict page.
import { requireAdminPage } from '@/lib/admin-auth';
import { db } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ReviewRow = {
  unit_id: string;
  source_agent: string;
  prompt_context: string;
  pool: string;
  created_at: number;
  yes_n: number;
  no_n: number;
  other_n: number;
  total_n: number;
  status: string;
  consensus: number;
};

const MIN_N = Number(process.env.PANEL_REVIEW_MIN_N || 3);
const THRESHOLD = Number(process.env.PANEL_REVIEW_THRESHOLD || 0.66);

function classify(yesN: number, noN: number, n: number) {
  const decisive = yesN + noN;
  const yesShare = decisive > 0 ? yesN / decisive : 0;
  const noShare = decisive > 0 ? noN / decisive : 0;
  if (n < MIN_N) return { status: 'pending', consensus: Math.max(yesShare, noShare) };
  if (yesShare >= THRESHOLD) return { status: 'approved', consensus: yesShare };
  if (noShare >= THRESHOLD) return { status: 'rejected', consensus: noShare };
  return { status: 'no_consensus', consensus: Math.max(yesShare, noShare) };
}

export default async function ReviewsPage() {
  const auth = await requireAdminPage();
  if (!auth.ok) return <Unauthorized />;

  // fetch all skill_diff* units with judgment tallies in one pass.
  const rows = db.prepare(
    `SELECT u.id AS unit_id, u.json AS unit_json, u.pool AS pool, u.created_at AS created_at,
            COALESCE(SUM(CASE WHEN j.choice='yes' AND j.honeypot_failed=0 THEN 1 ELSE 0 END), 0) AS yes_n,
            COALESCE(SUM(CASE WHEN j.choice='no'  AND j.honeypot_failed=0 THEN 1 ELSE 0 END), 0) AS no_n,
            COALESCE(SUM(CASE WHEN j.choice NOT IN ('yes','no') AND j.honeypot_failed=0 THEN 1 ELSE 0 END), 0) AS other_n
       FROM units u
       LEFT JOIN judgments j ON j.unit_id = u.id
      WHERE json_extract(u.json,'$.type') IN ('skill_diff', 'skill_diff_review')
      GROUP BY u.id, u.json, u.pool, u.created_at
      ORDER BY u.created_at DESC`
  ).all() as Array<{
    unit_id: string;
    unit_json: string;
    pool: string;
    created_at: number;
    yes_n: number;
    no_n: number;
    other_n: number;
  }>;

  const reviews: ReviewRow[] = rows.map((r) => {
    let unit: any = {};
    try { unit = JSON.parse(r.unit_json); } catch { /* noop */ }
    const totalN = r.yes_n + r.no_n + r.other_n;
    const { status, consensus } = classify(r.yes_n, r.no_n, totalN);
    return {
      unit_id: r.unit_id,
      source_agent: unit?.source_agent || '—',
      prompt_context: unit?.prompt_context || '—',
      pool: r.pool,
      created_at: r.created_at,
      yes_n: r.yes_n,
      no_n: r.no_n,
      other_n: r.other_n,
      total_n: totalN,
      status,
      consensus,
    };
  });

  const counts = reviews.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusColor: Record<string, string> = {
    approved: '#9ece6a',
    rejected: '#f7768e',
    pending: '#e0af68',
    no_consensus: '#bb9af7',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#eaeaea', fontFamily: 'ui-monospace, monospace' }}>
<main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px' }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>skill review queue</h1>
        <p style={{ color: '#888', marginBottom: 24 }}>
          rater-as-reviewer: skill diffs submitted by agents → human raters vote → CI gates use the verdict.
        </p>

        <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
          {(['approved', 'rejected', 'pending', 'no_consensus'] as const).map((s) => (
            <div
              key={s}
              style={{
                border: `1px solid ${statusColor[s]}`,
                padding: '12px 16px',
                borderRadius: 6,
                minWidth: 140,
              }}
            >
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>{s.replace('_', ' ')}</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: statusColor[s] }}>{counts[s] || 0}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
          gates: min_n={MIN_N} · threshold={Math.round(THRESHOLD * 100)}% · total units={reviews.length}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a2a', color: '#888', textAlign: 'left' }}>
              <th style={{ padding: '8px 8px' }}>status</th>
              <th style={{ padding: '8px 8px' }}>agent / skill</th>
              <th style={{ padding: '8px 8px' }}>context</th>
              <th style={{ padding: '8px 8px', textAlign: 'right' }}>yes</th>
              <th style={{ padding: '8px 8px', textAlign: 'right' }}>no</th>
              <th style={{ padding: '8px 8px', textAlign: 'right' }}>n</th>
              <th style={{ padding: '8px 8px', textAlign: 'right' }}>consensus</th>
              <th style={{ padding: '8px 8px' }}>created</th>
              <th style={{ padding: '8px 8px' }}>verdict</th>
            </tr>
          </thead>
          <tbody>
            {reviews.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#666' }}>
                  no skill_diff units yet. POST one to <code>/api/v1/skill-review</code>.
                </td>
              </tr>
            )}
            {reviews.map((r) => (
              <tr key={r.unit_id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                <td style={{ padding: '10px 8px' }}>
                  <span style={{ color: statusColor[r.status] || '#888', fontWeight: 500 }}>{r.status}</span>
                </td>
                <td style={{ padding: '10px 8px', fontFamily: 'ui-monospace, monospace', color: '#7aa2f7' }}>
                  {r.source_agent}
                </td>
                <td
                  style={{
                    padding: '10px 8px',
                    color: '#aaa',
                    maxWidth: 280,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={r.prompt_context}
                >
                  {r.prompt_context}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#9ece6a' }}>{r.yes_n}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#f7768e' }}>{r.no_n}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>{r.total_n}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                  {r.total_n > 0 ? `${Math.round(r.consensus * 100)}%` : '—'}
                </td>
                <td style={{ padding: '10px 8px', color: '#666', fontSize: 12 }}>
                  {new Date(r.created_at * 1000).toISOString().slice(0, 16).replace('T', ' ')}
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <a href={`/review/${r.unit_id}`} style={{ color: '#7aa2f7' }}>view →</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}

function Unauthorized() {
  return (
    <main style={{ padding: 24, fontFamily: 'ui-monospace, monospace' }}>
      <h1>admin only</h1>
      <p>set the <code>panel_admin_key</code> cookie to a value listed in <code>PANEL_ADMIN_KEYS</code> env.</p>
      <pre style={{ background: '#fafafa', padding: 8, fontSize: 12 }}>{`document.cookie = 'panel_admin_key=YOUR_KEY; path=/; samesite=lax'`}</pre>
    </main>
  );
}