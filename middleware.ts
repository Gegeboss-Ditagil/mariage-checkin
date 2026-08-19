import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionTokenEdge } from '@/lib/session-edge';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/manifest.json', '/sw.js'];

// Tout le monde sauf admin a exactement le meme acces (agent ou placeur) :
// seules les pages /admin restent reservees a l'admin.
const FULL_STAFF_PREFIXES = [
  '/',
  '/scan',
  '/table',
  '/checkin',
  '/search',
  '/dashboard',
  '/tables',
  '/exceptions',
  '/history',
  '/placement',
  '/api',
];

const READ_ONLY_PREFIXES = ['/', '/dashboard', '/tables', '/search', '/placement', '/api'];

const ROLE_ALLOWED_PREFIXES: Record<string, string[]> = {
  admin: ['/'], // acces total
  directeur: FULL_STAFF_PREFIXES,
  placeur: FULL_STAFF_PREFIXES,
  agent_checkin: FULL_STAFF_PREFIXES,
  visibilite: READ_ONLY_PREFIXES,
};

const DENY_SUBPATHS: Record<string, string[]> = {
  agent_checkin: ['/tables/move', '/tables/overflow', '/tables/add'],
  visibilite: ['/tables/move', '/tables/overflow', '/tables/add'],
};

function fallbackFor(role: string): string {
  if (role === 'placeur' || role === 'directeur') return '/placement';
  if (role === 'visibilite') return '/dashboard';
  return '/scan';
}

function isPublic(pathname: string) {
  return (
    pathname === '/' || // ecran splash, accessible sans session
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/images') ||
    pathname === '/favicon.ico'
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = await verifySessionTokenEdge(token);

  if (!user) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user.role === 'admin') {
    return NextResponse.next();
  }

  const allowed = ROLE_ALLOWED_PREFIXES[user.role] ?? [];
  const ok = allowed.some((prefix) => pathname === prefix || pathname.startsWith(prefix));

  if (!ok) {
    // Redirige vers l'ecran par defaut du role plutot que d'afficher une erreur
    return NextResponse.redirect(new URL(fallbackFor(user.role), req.url));
  }

  const deniedSubpaths = DENY_SUBPATHS[user.role] ?? [];
  const denied = deniedSubpaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (denied) return NextResponse.redirect(new URL('/tables', req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|images).*)'],
};

