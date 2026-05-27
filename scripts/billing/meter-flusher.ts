import { flushUsageEvents } from '@/lib/billing/meter';

async function main() {
  const r = await flushUsageEvents();
  console.log(JSON.stringify({ ok: true, flushed: r.flushed, ts: Date.now() }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
