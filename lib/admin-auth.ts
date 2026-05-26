// lib/admin-auth.ts — admin gate.
//
// Two paths, in priority order:
//   1) Authentik OIDC session (real per-user identity, group: panel-admins)
//   2) Bearer key from PANEL_ADMIN_KEYS (legacy; for CI/scripts/curl)
//
// Public API kept identical to the prior shared-secret implementation so
// existing route handlers (requireAdmin / requireAdminPage) don't change.
import { NextRequest, NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions, ADMIN_GROUPS } from '@/lib/auth-options';

export function adminKeys(): string[] {
  const raw = process.env.PANEL_ADMIN_KEYS || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export function isAdminKey(k: string | null | undefined): boolean {
  if (!k) return false;
  const allow = adminKeys();
  if (allow.length === 0) return false;
  return allow.includes(k);
}

function extractKey(req: NextRequest): string {
  return (
    req.headers.get('x-panel-admin-key') ||
    req.cookies.get('panel_admin_key')?.value ||
    req.nextUrl.searchParams.get('admin_key') ||
    ''
  );
}

export async function requireAdmin(req: NextRequest): Promise<
  | { ok: true; admin_key: string }
  | { ok: false; res: NextResponse }
> {
  // 1) SSO session
  try {
    const session: any = await getServerSession(authOptions);
    if (session?.isAdmin && session.user?.email) {
      return { ok: true, admin_key: session.user.email };
    }
  } catch {
    // session lookup failed — fall through to bearer
  }

  // 2) bearer key (CI / scripts)
  const k = extractKey(req);
  if (isAdminKey(k)) {
    return { ok: true, admin_key: k };
  }

  return { ok: false, res: NextResponse.json({ error: 'admin_only' }, { status: 401 }) };
}

// server-component variant for app/admin pages
export async function requireAdminPage(): Promise<
  | { ok: true; admin_key: string }
  | { ok: false }
> {
  try {
    const session: any = await getServerSession(authOptions);
    if (session?.isAdmin && session.user?.email) {
      return { ok: true, admin_key: session.user.email };
    }
  } catch {}

  try {
    const c = cookies().get('panel_admin_key')?.value;
    const h = headers().get('x-panel-admin-key');
    const k = c || h || '';
    if (isAdminKey(k)) return { ok: true, admin_key: k };
  } catch {}

  return { ok: false };
}

export { ADMIN_GROUPS };
