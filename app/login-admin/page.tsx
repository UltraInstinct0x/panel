// /admin/login — kicks the user into Authentik OIDC login.
// SessionProvider lives at the root (RootSessionProvider in app/layout.tsx),
// so this page only needs the Suspense wrapper for useSearchParams().
'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

const COLORS = {
  bg: '#08080b', bg2: '#0f0f14',
  fg: '#e8e8ec', fgDim: '#9a9aa3', fgFaint: '#5b5b65',
  border: 'rgba(255,255,255,0.06)', borderStrong: 'rgba(255,255,255,0.12)',
  cyan: '#67e8f9', red: '#fca5a5',
};

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginInner />
    </Suspense>
  );
}

function AdminLoginInner() {
  const params = useSearchParams();
  const error = params.get('error');
  const callbackUrl = params.get('callbackUrl') || '/admin/contact';
  // (page lives at /login-admin to avoid recursing through the /admin gate)
  const { status } = useSession();
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      window.location.href = callbackUrl;
    }
  }, [status, callbackUrl]);

  return (
    <main style={{
      background: COLORS.bg, color: COLORS.fg, minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', fontSize: 13,
    }}>
      <div style={{
        background: COLORS.bg2, border: `1px solid ${COLORS.border}`,
        borderRadius: 8, padding: 32, width: 360,
      }}>
        <div style={{ fontSize: 11, color: COLORS.fgFaint, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          panel · admin
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 500, margin: '4px 0 18px', letterSpacing: -0.2 }}>sign in</h1>

        {error && (
          <div style={{ background: '#2a0f12', color: COLORS.red, padding: 10, borderRadius: 6, marginBottom: 14, fontSize: 11 }}>
            {error === 'AccessDenied' ? 'not in panel-admins group' : `auth error: ${error}`}
          </div>
        )}

        <button
          onClick={() => { setPressed(true); signIn('authentik', { callbackUrl }); }}
          disabled={pressed}
          style={{
            width: '100%', background: COLORS.cyan, color: '#000', border: 'none',
            borderRadius: 6, padding: '10px 14px', fontSize: 13, fontWeight: 500,
            cursor: pressed ? 'wait' : 'pointer', opacity: pressed ? 0.6 : 1,
          }}
        >
          {pressed ? 'redirecting…' : 'continue with authentik →'}
        </button>

        <div style={{ marginTop: 14, fontSize: 10, color: COLORS.fgFaint, lineHeight: 1.6 }}>
          group <code style={{ background: COLORS.bg, padding: '0 4px', borderRadius: 2 }}>panel-admins</code> required.
          contact ops at <a href="/contact?topic=general" style={{ color: COLORS.cyan }}>/contact</a> if you need access.
        </div>
      </div>
    </main>
  );
}
