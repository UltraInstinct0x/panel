// next.js instrumentation entrypoint — runs once at server startup (node runtime).
// registers sqlite shutdown + ratelimit flusher eagerly so they're armed before first request.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerShutdown } = await import('./lib/db');
    registerShutdown();
    const { startFlusher } = await import('./lib/ratelimit');
    startFlusher();
  }
}
