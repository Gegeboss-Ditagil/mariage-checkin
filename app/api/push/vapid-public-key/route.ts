import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';
import { webPushPublicKey } from '@/lib/webPush';

export async function GET() {
  const user = getSessionUser();
  // Toute personne qui voit les demandes peut recevoir une alerte. La
  // décision reste protégée séparément par reviewGuestApproval.
  if (!user || !hasCapability(user.role, 'viewGuestApprovals')) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const publicKey = webPushPublicKey();
  return publicKey ? NextResponse.json({ public_key: publicKey }) : NextResponse.json({ error: 'push_not_configured' }, { status: 503 });
}
