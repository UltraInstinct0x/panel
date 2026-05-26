// app/_components/RootSessionProvider.tsx — wraps the entire tree so any client component can call useSession/signOut.
'use client';
import { SessionProvider } from 'next-auth/react';
export default function RootSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
