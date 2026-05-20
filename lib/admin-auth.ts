// WS-O: admin-role auth on top of operator site-key system.
// admins = env-listed keys: PANEL_ADMIN_KEYS=admin_xxx,admin_yyy
import { NextRequest, NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';

export function adminKeys(): string[] {
  const raw = process.env.PANEL_ADMIN_KEYS || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export function isAdminKey(k: string | null | undefined): boolean {
  if (!k) return false;
  const allow = adminKeys();
  if (allow.length === 0) return false; // no admin configured = closed
  return allow.includes(k);
}

export function requireAdmin(req: NextRequest):
  | { ok: true; admin_key: string }
  | { ok: false; res: NextResponse } {
  const k =
    req.headers.get('x-panel-admin-key') ||
    req.cookies.get('panel_admin_key')?.value ||
    req.nextUrl.searchParams.get('admin_key') ||
    '';
  if (!isAdminKey(k)) {
    return { ok: false, res: NextResponse.json({ error: 'admin_only' }, { status: 401 }) };
  }
  return { ok: true, admin_key: k };
}

// server-component variant for app/admin pages
export function requireAdminPage(): { ok: true; admin_key: string } | { ok: false } {
  try {
    const c = cookies().get('panel_admin_key')?.value;
    const h = headers().get('x-panel-admin-key');
    const k = c || h || '';
    return isAdminKey(k) ? { ok: true, admin_key: k } : { ok: false };
  } catch {
    return { ok: false };
  }
}
