// app/admin/layout.tsx — gates all /admin/* pages.
// Login lives at /login-admin (outside this tree) so no recursion.
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { isAdminKey } from '@/lib/admin-auth';
import { cookies } from 'next/headers';
import SessionProvider from './session-provider';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    const session: any = await getServerSession(authOptions);
    if (session?.isAdmin) {
      return <SessionProvider session={session}>{children}</SessionProvider>;
    }
  } catch {}

  try {
    const k = cookies().get('panel_admin_key')?.value;
    if (isAdminKey(k)) return <>{children}</>;
  } catch {}

  redirect('/login-admin');
}
