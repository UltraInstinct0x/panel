import { getServerSession, type Session } from 'next-auth';
import { authOptions } from './auth-options';

export const __panelSessionImpl: { fn: () => Promise<Session | null> } = {
  fn: () => getServerSession(authOptions) as Promise<Session | null>,
};

export async function getPanelSession(): Promise<Session | null> {
  return __panelSessionImpl.fn();
}
