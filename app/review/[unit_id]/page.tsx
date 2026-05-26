// /review/[unit_id] — public, shareable verdict page for a skill-diff review.
// Anyone can land here from a PR comment, blog post, or rater notification.
// Live tally polls /api/v1/skill-review/[unit_id], embeds the same captcha pill
// raters use to cast their vote.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function fetchVerdict(unitId: string) {
  // server-side fetch: route is co-located, hit by absolute URL via env or relative on same origin
  const base = process.env.PANEL_PUBLIC_URL || 'http://127.0.0.1:3015';
  try {
    const r = await fetch(`${base}/api/v1/skill-review/${unitId}`, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export default async function ReviewPage({ params }: { params: { unit_id: string } }) {
  const verdict = await fetchVerdict(params.unit_id);

  if (!verdict || verdict.error) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#eaeaea', fontFamily: 'ui-monospace, monospace' }}>
<main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px' }}>
          <h1 style={{ fontSize: 28, marginBottom: 16 }}>review not found</h1>
          <p style={{ color: '#888' }}>
            no skill-review unit at <code style={{ color: '#eaeaea' }}>{params.unit_id}</code>.
          </p>
          <p style={{ marginTop: 24 }}>
            <a href="/demo/agent" style={{ color: '#7aa2f7' }}>← back to /demo/agent</a>
          </p>
        </main>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    approved: '#9ece6a',
    rejected: '#f7768e',
    pending: '#e0af68',
    no_consensus: '#bb9af7',
  };
  const statusLabel: Record<string, string> = {
    approved: 'approved',
    rejected: 'rejected',
    pending: 'pending — gathering reviews',
    no_consensus: 'no consensus',
  };

  const consensusPct = Math.round((verdict.consensus || 0) * 100);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#eaeaea', fontFamily: 'ui-monospace, monospace' }}>
<main style={{ maxWidth: 880, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>panel skill review</div>
        <h1 style={{ fontSize: 28, margin: '0 0 8px 0' }}>
          <code style={{ color: '#eaeaea' }}>{verdict.source_agent || 'skill diff'}</code>
        </h1>
        <div style={{ color: '#888', marginBottom: 32 }}>
          {verdict.prompt_context || 'agent proposed a skill update'}
        </div>

        <div
          style={{
            border: `1px solid ${statusColor[verdict.status] || '#444'}`,
            background: '#111',
            padding: '24px',
            borderRadius: 8,
            marginBottom: 32,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>verdict</div>
              <div style={{ fontSize: 24, color: statusColor[verdict.status] || '#eaeaea', fontWeight: 600 }}>
                {statusLabel[verdict.status] || verdict.status}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>consensus</div>
              <div style={{ fontSize: 24, fontWeight: 600 }}>{consensusPct}%</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#aaa' }}>
            <div>
              <span style={{ color: '#9ece6a' }}>{verdict.counts.yes} ship</span>
              {' · '}
              <span style={{ color: '#f7768e' }}>{verdict.counts.no} reject</span>
              {verdict.counts.other > 0 && (
                <>
                  {' · '}
                  <span style={{ color: '#888' }}>{verdict.counts.other} other</span>
                </>
              )}
            </div>
            <div style={{ color: '#666' }}>
              n={verdict.n} / min_n={verdict.min_n}, threshold={Math.round(verdict.threshold * 100)}%
            </div>
          </div>
        </div>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12, color: '#eaeaea' }}>cast your vote</h2>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
            click the pill, solve the captcha, vote on whether this diff should ship.
          </p>
          <div className="panel-captcha" data-panel-site-key="pk_demo_a" data-panel-pool="technical" data-panel-tier="c3"></div>
          <script src="/v1.js" async defer></script>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12, color: '#eaeaea' }}>verdict json</h2>
          <pre
            style={{
              background: '#0d1117',
              padding: 16,
              borderRadius: 6,
              fontSize: 12,
              border: '1px solid #1f2428',
              overflow: 'auto',
              color: '#c9d1d9',
            }}
          >
{JSON.stringify(
  {
    unit_id: verdict.unit_id,
    status: verdict.status,
    consensus: verdict.consensus,
    n: verdict.n,
    counts: verdict.counts,
    threshold: verdict.threshold,
    min_n: verdict.min_n,
    last_judged_at: verdict.last_judged_at,
  },
  null,
  2,
)}
          </pre>
        </section>

        <section>
          <h2 style={{ fontSize: 16, marginBottom: 12, color: '#eaeaea' }}>poll this verdict from CI</h2>
          <pre
            style={{
              background: '#0d1117',
              padding: 16,
              borderRadius: 6,
              fontSize: 12,
              border: '1px solid #1f2428',
              overflow: 'auto',
              color: '#c9d1d9',
            }}
          >
{`curl -s https://panel.goku.codes/api/v1/skill-review/${verdict.unit_id} | jq .status`}
          </pre>
          <p style={{ color: '#888', fontSize: 13, marginTop: 12 }}>
            see <a href="https://github.com/UltraInstinct0x/panel-opencode-plugin" style={{ color: '#7aa2f7' }}>panel-opencode-plugin</a>
            {' '}for the GitHub Action template that gates PR merge on rater consensus.
          </p>
        </section>
      </main>
    </div>
  );
}