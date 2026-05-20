// operator site-key auth. allowlist via env: PANEL_SITE_KEYS=pk_demo_a,pk_demo_b
import { NextRequest, NextResponse } from 'next/server';

export function siteKeys(): string[] {
  const raw = process.env.PANEL_SITE_KEYS || 'pk_demo_a,pk_demo_b';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export function isValidSiteKey(k: string | null | undefined): boolean {
  if (!k) return false;
  return siteKeys().includes(k);
}

export function requireSiteKey(req: NextRequest):
  | { ok: true; site_key: string }
  | { ok: false; res: NextResponse } {
  const k =
    req.headers.get('x-panel-site-key') ||
    req.nextUrl.searchParams.get('site_key') ||
    '';
  if (!isValidSiteKey(k)) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'missing_or_invalid_site_key' }, { status: 401 }),
    };
  }
  return { ok: true, site_key: k };
}
