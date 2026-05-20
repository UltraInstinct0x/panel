// edge middleware: security headers, CORS for /api/*, framing rules for /embed.
// runs on every request. rate limiting lives in route handlers (needs node runtime + sqlite).
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

const ALLOWED_DEMO_KEYS = new Set(['pk_demo_a', 'pk_demo_b']);

// minimal CSP. allow self + inline (Next.js needs it for hydration), and self-hosted styles.
// `frame-ancestors` is set per-route below.
function baseCSP(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

function applySecurityHeaders(res: NextResponse, framing: 'deny' | 'open') {
  const csp =
    framing === 'open'
      ? `${baseCSP()}; frame-ancestors *`
      : `${baseCSP()}; frame-ancestors 'self'`;
  res.headers.set('Content-Security-Policy', csp);
  if (framing === 'deny') {
    res.headers.set('X-Frame-Options', 'DENY');
  } else {
    res.headers.delete('X-Frame-Options'); // allow embedding
  }
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
}

function applyCORS(req: NextRequest, res: NextResponse) {
  const origin = req.headers.get('origin');
  if (!origin) return;
  const siteKey =
    req.headers.get('x-panel-site-key') ||
    req.nextUrl.searchParams.get('site_key') ||
    '';
  // demo keys: permissive (PoC convenience)
  // real keys: explicit allowlist via env PANEL_KEY_ORIGINS_<key>=https://a.com,https://b.com
  let allow = '';
  if (ALLOWED_DEMO_KEYS.has(siteKey)) {
    allow = '*';
  } else if (siteKey) {
    const envKey = `PANEL_KEY_ORIGINS_${siteKey.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    const list = (process.env[envKey] || '').split(',').map(s => s.trim()).filter(Boolean);
    if (list.includes(origin)) allow = origin;
  }
  if (allow) {
    res.headers.set('Access-Control-Allow-Origin', allow);
    res.headers.set('Vary', 'Origin');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Panel-Site-Key');
    res.headers.set('Access-Control-Max-Age', '600');
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');
  const isEmbed = pathname === '/embed' || pathname.startsWith('/embed/') || pathname === '/widget' || pathname.startsWith('/widget/');

  // CORS preflight short-circuit
  if (isApi && req.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 });
    applyCORS(req, res);
    applySecurityHeaders(res, 'deny');
    return res;
  }

  const res = NextResponse.next();
  applySecurityHeaders(res, isEmbed ? 'open' : 'deny');
  if (isApi) applyCORS(req, res);
  return res;
}
