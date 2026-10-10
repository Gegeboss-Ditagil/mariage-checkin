import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

// v1.78.0 : vérifiée régulièrement par components/SessionWatcher.tsx. Relit
// le rôle et l'état du compte en base (lib/session.ts) : un rôle changé par
// un admin réécrit ici la session ; un compte désactivé reçoit 401.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Session expirée' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ role: user.role }, { headers: { 'Cache-Control': 'private, no-store' } });
}
