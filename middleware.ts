import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionTokenEdge } from '@/lib/session-edge';
import { canAccessPath, landingPathForRole } from '@/lib/permissions';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/manifest.json', '/sw.js'];

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

function redirectToLogin(req: NextRequest, pathname: string) {
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('next', pathname);
  const res = NextResponse.redirect(loginUrl);

  // Une session expiree, invalide ou issue d'un ancien deploiement doit etre
  // nettoyee entierement pour eviter que l'UI client conserve un ancien role
  // ou un ancien nom pendant la reconnexion.
  res.cookies.set(SESSION_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  res.cookies.set('wc_role', '', { path: '/', maxAge: 0 });
  res.cookies.set('wc_name', '', { path: '/', maxAge: 0 });

  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = await verifySessionTokenEdge(token);

  if (!user) {
    return redirectToLogin(req, pathname);
  }

  if (user.role === 'admin') {
    return NextResponse.next();
  }

  if (!canAccessPath(user.role, pathname)) {
    // Redirige vers l'ecran par defaut du role plutot que d'afficher une erreur
    return NextResponse.redirect(new URL(landingPathForRole(user.role), req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|images).*)'],
};
