// WS-O: weekly honeypot rotation.
// - retire any honeypot served ≥50 times (rotation, not generation)
// - discord alert if any unit_type's active pool drops below 3
// schedule via Hermes cronjob tool: '0 4 * * 0' (sun 4am)
//
// run: `node --import tsx cron/honeypot-rotate.ts` or `pnpm tsx cron/honeypot-rotate.ts`
import { db } from '../lib/db';
import { listHoneypots, activeCountsByType, retireHoneypot, HONEYPOT_TYPES, ensureHoneypotSchema } from '../lib/honeypot';

const RETIRE_THRESHOLD = 50;
const MIN_PER_TYPE = 3;

async function discordAlert(text: string): Promise<void> {
  const url = process.env.PANEL_DISCORD_WEBHOOK;
  if (url) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[honeypot-rotate] discord webhook failed:', e);
    }
    return;
  }
  // fallback: hermes bridge daemon (file at /tmp/hermes_bridge.port)
  try {
    const fs = await import('fs');
    if (fs.existsSync('/tmp/hermes_bridge.port')) {
      const port = parseInt(fs.readFileSync('/tmp/hermes_bridge.port', 'utf8').trim(), 10);
      if (port) {
        await fetch(`http://127.0.0.1:${port}/notify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ source: 'honeypot-rotate', text }),
        }).catch(() => {});
        return;
      }
    }
  } catch {}
  // eslint-disable-next-line no-console
  console.warn('[honeypot-rotate] no discord webhook + no bridge — alert dropped:', text);
}

async function main(): Promise<void> {
  ensureHoneypotSchema();
  const before = listHoneypots({ status: 'active' });
  const toRetire = before.filter(h => h.served_count >= RETIRE_THRESHOLD);
  for (const h of toRetire) retireHoneypot(h.honeypot_id);
  const counts = activeCountsByType();
  const low: string[] = [];
  for (const t of HONEYPOT_TYPES) {
    if ((counts[t] ?? 0) < MIN_PER_TYPE) low.push(`${t}=${counts[t] ?? 0}`);
  }
  const summary = {
    ts: new Date().toISOString(),
    active_before: before.length,
    retired: toRetire.length,
    retired_ids: toRetire.map(h => h.honeypot_id),
    active_after_counts: counts,
    below_threshold: low,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
  if (low.length > 0) {
    await discordAlert(`⚠ panel honeypot pool low: ${low.join(', ')} (min ${MIN_PER_TYPE}/type). seed more via /admin/honeypots/new.`);
  }
  try { db.close(); } catch {}
}

main().catch(e => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
