// app/_components/AppShell.tsx — global header. Server component, session-aware, path-aware.
// Renders nothing for embed/widget/login routes. Adds admin section when session.isAdmin
// or when a legacy admin bearer key is present (matches requireAdminPage()'s logic).
//
// NOTE: AppShell calls headers() + getServerSession(), which forces every route using the
// root layout to be dynamic. That's acceptable for now — the marketing pages aren't hot
// enough to justify splitting layouts. If/when /, /pricing, /how-it-works become traffic-
// critical, refactor into a (marketing) route group with a static layout and an (app)
// route group with this session-aware one.
import Link from 'next/link';
import { headers, cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { isAdminKey } from '@/lib/admin-auth';
import AppNavClient from './AppNavClient';

// Routes where we suppress the whole shell (chromeless surfaces).
const CHROMELESS_PREFIXES = ['/embed', '/widget', '/login-admin', '/api/'];
// Routes where we omit the footer but keep the header (focused work surfaces).
const NO_FOOTER_PREFIXES = ['/admin', '/dashboard', '/operator', '/review'];

function getPathname(): string {
  return headers().get('x-pathname') || '/';
}

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = getPathname();
  const chromeless = CHROMELESS_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p));
  if (chromeless) return <>{children}</>;

  const session: any = await getServerSession(authOptions).catch(() => null);
  const sessionAdmin = !!session?.isAdmin;
  // Legacy bearer-key path: matches requireAdminPage() so admins authed via
  // panel_admin_key cookie or x-panel-admin-key header also see the admin nav.
  const bearerCookie = cookies().get('panel_admin_key')?.value;
  const bearerHeader = headers().get('x-panel-admin-key');
  const bearerAdmin = isAdminKey(bearerCookie) || isAdminKey(bearerHeader);
  const isAdmin = sessionAdmin || bearerAdmin;
  const email = session?.user?.email || null;
  const showFooter = !NO_FOOTER_PREFIXES.some(p => pathname.startsWith(p));

  return (
    <>
      <AppNavClient pathname={pathname} isAdmin={isAdmin} email={email} />
      {children}
      {showFooter && <AppFooter />}
    </>
  );
}

function AppFooter() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border-subtle)',
      padding: '24px 32px',
      marginTop: 64,
      fontSize: 12,
      color: 'var(--fg-faint, #5b5b65)',
      fontFamily: 'var(--sans), Inter, system-ui, sans-serif',
      display: 'flex',
      flexWrap: 'wrap',
      gap: 16,
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div>▰ panel · proof-of-humanity that produces signal</div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <Link href="/privacy" style={{ color: 'inherit' }}>privacy</Link>
        <Link href="/terms" style={{ color: 'inherit' }}>terms</Link>
        <Link href="/contact" style={{ color: 'inherit' }}>contact</Link>
        <Link href="/docs" style={{ color: 'inherit' }}>docs</Link>
        <a href="https://github.com/UltraInstinct0x/panel" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>github</a>
      </div>
    </footer>
  );
}
