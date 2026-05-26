// lib/auth-options.ts — NextAuth config: Authentik OIDC + groups → panel-admins gate.
import type { NextAuthOptions } from 'next-auth';

const issuer = process.env.AUTHENTIK_ISSUER || '';
const clientId = process.env.AUTHENTIK_CLIENT_ID || '';
const clientSecret = process.env.AUTHENTIK_CLIENT_SECRET || '';

// Authentik returns groups in the userinfo / id_token when scope=goauthentik.io/api or `groups` claim is enabled.
// We request openid+email+profile by default and rely on a custom property mapping to expose groups.
// Group allow-list (comma-separated). User must be in at least one to gain admin.
export const ADMIN_GROUPS = (process.env.PANEL_ADMIN_GROUPS || 'panel-admins')
  .split(',').map(s => s.trim()).filter(Boolean);

export const authOptions: NextAuthOptions = {
  // NextAuth needs NEXTAUTH_SECRET in env. JWT sessions (no DB).
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 }, // 8h
  providers: [
    {
      id: 'authentik',
      name: 'Authentik',
      type: 'oauth',
      wellKnown: `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`,
      clientId,
      clientSecret,
      authorization: { params: { scope: 'openid email profile groups' } },
      idToken: true,
      checks: ['pkce', 'state'],
      profile(profile: any) {
        return {
          id: profile.sub,
          name: profile.name || profile.preferred_username || profile.email,
          email: profile.email,
          // groups can arrive on id_token or userinfo as `groups` (array of strings)
          // we'll capture them in the jwt() callback below
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // first sign-in: pull groups from the id_token / userinfo profile
      if (account && profile) {
        const p: any = profile;
        const groups: string[] = Array.isArray(p.groups) ? p.groups : [];
        token.groups = groups;
        token.email = p.email || token.email;
        token.name = p.name || p.preferred_username || token.name;
        token.isAdmin = groups.some(g => ADMIN_GROUPS.includes(g));
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).groups = token.groups || [];
      (session as any).isAdmin = !!token.isAdmin;
      if (session.user) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login-admin',
    error: '/login-admin',
  },
};
