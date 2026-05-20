// scrubber-client — fail-closed wrapper around scrubber-proxy.
// Used by /api/units/next for pool=technical.
// If SCRUBBER_URL is unset, scrubbing is a no-op (panel runs standalone).
// If SCRUBBER_URL is set and the call fails, the caller must NOT serve the unit.

export type ScrubResult = {
  ok: true;
  text: string;
  detections: { token: string; category: string; pack: string }[];
  rules_applied: string[];
  engine_version: string;
} | { ok: false; error: string };

const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_RULES = process.env.SCRUBBER_RULES || 'base';

export function scrubberConfigured(): boolean {
  return !!process.env.SCRUBBER_URL;
}

export async function scrubText(text: string, rules: string = DEFAULT_RULES): Promise<ScrubResult> {
  const base = process.env.SCRUBBER_URL;
  if (!base) return { ok: true, text, detections: [], rules_applied: [], engine_version: 'noop' };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const url = `${base.replace(/\/$/, '')}/scrub?rules=${encodeURIComponent(rules)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, error: `scrubber_${res.status}` };
    const body = await res.json();
    return {
      ok: true,
      text: body.text,
      detections: body.detections || [],
      rules_applied: body.rules_applied || [],
      engine_version: body.engine_version || 'unknown',
    };
  } catch (e: any) {
    return { ok: false, error: e?.name === 'AbortError' ? 'scrubber_timeout' : `scrubber_error:${e?.message || e}` };
  } finally {
    clearTimeout(timer);
  }
}
