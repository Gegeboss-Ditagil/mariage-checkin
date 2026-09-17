import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionTokenEdge } from '@/lib/session-edge';
import { canAccessPath, landingPathForRole } from '@/lib/permissions';

// '/approve' (page publique d'approbation SMS) et '/api/public' (ses routes
// API) n'exigent jamais de session -- la connaissance du token (lien SMS)
// EST l'autorisation, voir supabase/migrations/0032_guest_approvals.sql.
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/manifest.json', '/sw.js', '/approve', '/api/public'];

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

  // Une session expiree ou invalide doit etre nettoyee entierement pour
  // eviter que l'UI client conserve un ancien role ou un ancien nom pendant
  // la reconnexion.
  res.cookies.set(SESSION_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  res.cookies.set('wc_role', '', { path: '/', maxAge: 0 });
  res.cookies.set('wc_name', '', { path: '/', maxAge: 0 });

  return res;
}

// Next.js precharge automatiquement en arriere-plan CHAQUE <Link> visible a
// l'ecran (BottomNav en affiche 4-5 sur chaque page) -- une simple requete de
// prefetch, jamais montree a l'utilisateur, jamais une vraie navigation. Sans
// cette distinction, un prefetch qui echoue la verification de session (ex :
// un cookie qui expire pile entre deux clics) renvoyait quand meme les
// en-tetes Set-Cookie qui effacent la session -- le navigateur les applique
// meme si la reponse du prefetch n'est jamais affichee, deconnectant
// silencieusement l'utilisateur en train de regarder une AUTRE page qui,
// elle, avait un cookie parfaitement valide. Un prefetch sans session valide
// est simplement laisse passer (la vraie navigation vers cette page, elle,
// redirigera normalement) plutot que de risquer d'effacer une session par
// ailleurs valide. Voir lib/sessionVersion.ts pour l'autre volet de ce
// correctif (17/09/2026, retour de Gersom : deconnexions frequentes en
// navigant rapidement entre les pages).
function isPrefetch(req: NextRequest): boolean {
  return req.headers.get('next-router-prefetch') === '1' || req.headers.get('purpose') === 'prefetch';
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = await verifySessionTokenEdge(token);

  if (!user) {
    if (isPrefetch(req)) return NextResponse.next();
    return redirectToLogin(req, pathname);
  }

  if (user.role === 'admin') {
    return NextResponse.next();
  }

  // Ecran de choix de theme (une seule fois apres la premiere connexion,
  // voir app/onboarding/theme/page.tsx) : accessible a tout role authentifie,
  // hors de la matrice de capacites -- pure preference d'affichage, aucune
  // donnee sensible exposee. Ne pas ajouter a lib/permissions.ts pour ca.
  if (pathname.startsWith('/onboarding')) {
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
