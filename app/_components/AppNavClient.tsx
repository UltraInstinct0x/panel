// app/_components/AppNavClient.tsx — interactive top nav (collapsible mobile, dropdowns, signout).
'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { signOut } from 'next-auth/react';

type NavItem = { href: string; label: string };

const PRODUCT: NavItem[] = [
  { href: '/how-it-works', label: 'how it works' },
  { href: '/demo/gate',    label: 'gate demo' },
  { href: '/demo/agent',   label: 'agent demo' },
  { href: '/pricing',      label: 'pricing' },
  { href: '/docs',         label: 'docs' },
];

const APP: NavItem[] = [
  { href: '/dashboard',          label: 'dashboard' },
  { href: '/operator',           label: 'operator' },
  { href: '/review/u_skill_001', label: 'reviews' },
];

const ADMIN: NavItem[] = [
  { href: '/admin/contact',   label: 'contact triage' },
  { href: '/admin/onboard',   label: 'onboarding' },
  { href: '/admin/operators', label: 'operators' },
  { href: '/admin/reviews',   label: 'review queue' },
  { href: '/admin/honeypots', label: 'honeypots' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function AppNavClient({
  pathname, isAdmin, email,
}: { pathname: string; isAdmin: boolean; email: string | null }) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<'product' | 'app' | 'admin' | 'me' | null>(null);
  const wrapRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenu(null);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setOpen(false); setMenu(null); }, [pathname]);

  return (
    <nav className="topbar" ref={wrapRef as any}>
      <Link href="/" className="brand">▰ panel</Link>

      {/* Desktop nav */}
      <div className="nav-groups" data-mobile-hidden>
        <NavGroup label="product" items={PRODUCT} open={menu === 'product'}
                  onToggle={() => setMenu(menu === 'product' ? null : 'product')}
                  pathname={pathname} />
        <NavGroup label="app" items={APP} open={menu === 'app'}
                  onToggle={() => setMenu(menu === 'app' ? null : 'app')}
                  pathname={pathname} />
        {isAdmin && (
          <NavGroup label="admin" items={ADMIN} open={menu === 'admin'}
                    onToggle={() => setMenu(menu === 'admin' ? null : 'admin')}
                    pathname={pathname} accent />
        )}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        {email ? (
          <div style={{ position: 'relative' }}>
            <button className="nav-pill" onClick={() => setMenu(menu === 'me' ? null : 'me')}>
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: 3,
                background: '#86efac', marginRight: 6, verticalAlign: 'middle',
              }} />
              {email.split('@')[0]}
              <span style={{ marginLeft: 6, opacity: 0.5 }}>▾</span>
            </button>
            {menu === 'me' && (
              <div className="nav-dropdown" style={{ right: 0, left: 'auto' }}>
                <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-faint)', borderBottom: '1px solid var(--border-subtle)' }}>
                  {email}
                </div>
                <button onClick={() => signOut({ callbackUrl: '/' })} className="nav-dropdown-item">sign out</button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/login-admin" className="nav-pill">sign in</Link>
        )}
        <button className="nav-hamburger" onClick={() => setOpen(!open)} aria-label="menu">{open ? '×' : '☰'}</button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="nav-mobile-drawer">
          <MobileSection label="product" items={PRODUCT} pathname={pathname} />
          <MobileSection label="app" items={APP} pathname={pathname} />
          {isAdmin && <MobileSection label="admin" items={ADMIN} pathname={pathname} />}
        </div>
      )}
    </nav>
  );
}

function NavGroup({
  label, items, open, onToggle, pathname, accent,
}: { label: string; items: NavItem[]; open: boolean; onToggle: () => void; pathname: string; accent?: boolean }) {
  const active = items.some(i => isActive(pathname, i.href));
  return (
    <div style={{ position: 'relative' }}>
      <button
        className="nav-group-trigger"
        data-active={active ? 'true' : undefined}
        data-accent={accent ? 'true' : undefined}
        onClick={onToggle}
      >
        {label}<span style={{ marginLeft: 4, opacity: 0.5, fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div className="nav-dropdown">
          {items.map(it => (
            <Link key={it.href} href={it.href} className="nav-dropdown-item"
                  data-active={isActive(pathname, it.href) ? 'true' : undefined}>
              {it.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileSection({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 10, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(it => (
          <Link key={it.href} href={it.href}
                style={{ fontSize: 14, color: isActive(pathname, it.href) ? 'var(--fg)' : 'var(--fg-dim)', padding: '6px 0' }}>
            {it.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
