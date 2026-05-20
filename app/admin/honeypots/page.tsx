// WS-O: admin UI. list / new / stats for honeypots.
// auth: admin role (PANEL_ADMIN_KEYS). server-side gate; UI prompts to set cookie.
import { requireAdminPage } from '@/lib/admin-auth';
import { listHoneypots, getHoneypotStats, activeCountsByType, HONEYPOT_TYPES } from '@/lib/honeypot';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function HoneypotsAdminPage() {
  const a = requireAdminPage();
  if (!a.ok) return <Unauthorized />;
  const rows = listHoneypots();
  const active = activeCountsByType();
  return (
    <main style={{ padding: 24, fontFamily: 'ui-monospace, monospace', maxWidth: 1100 }}>
      <h1 style={{ fontSize: 20 }}>honeypots</h1>
      <p style={{ opacity: 0.7, fontSize: 13 }}>
        adversarial units where the obvious LLM answer is wrong by design. failing one = trust × 0.85 + behavioral floor.
      </p>

      <section style={{ margin: '16px 0', padding: 12, background: '#fafafa', border: '1px solid #eee', borderRadius: 6 }}>
        <strong style={{ fontSize: 13 }}>active pool per type</strong>
        <ul style={{ fontSize: 13, margin: '6px 0', padding: 0, listStyle: 'none' }}>
          {HONEYPOT_TYPES.map(t => {
            const n = active[t] ?? 0;
            const low = n < 3;
            return (
              <li key={t} style={{ color: low ? '#a00' : '#333' }}>
                {t}: {n}{low ? ' ⚠ below 3-per-type alert threshold' : ''}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: 16 }}>
          all honeypots ({rows.length}) — <Link href="/admin/honeypots/new">+ new</Link>
        </h2>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
              <th>id</th><th>type</th><th>status</th><th>served</th><th>fail %</th><th>last served</th><th>notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(h => {
              const s = getHoneypotStats(h.honeypot_id);
              const failPct = s.served > 0 ? Math.round((s.failed / s.served) * 100) : 0;
              return (
                <tr key={h.honeypot_id} style={{ borderBottom: '1px solid #eee', verticalAlign: 'top' }}>
                  <td style={{ fontFamily: 'monospace' }}>{h.honeypot_id.slice(0, 12)}</td>
                  <td>{h.unit_type}</td>
                  <td>{h.retired_at ? 'retired' : 'active'}</td>
                  <td>{s.served}</td>
                  <td>{failPct}%</td>
                  <td>{s.last_served_at ? new Date(s.last_served_at).toISOString().slice(0, 10) : '—'}</td>
                  <td style={{ maxWidth: 380, fontSize: 11, opacity: 0.75 }}>{h.expert_notes.slice(0, 140)}{h.expert_notes.length > 140 ? '…' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
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
