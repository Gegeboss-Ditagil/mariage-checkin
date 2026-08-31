import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';
import { webPushPublicKey } from '@/lib/webPush';

export async function GET() {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'reviewGuestApproval')) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const publicKey = webPushPublicKey();
  return publicKey ? NextResponse.json({ public_key: publicKey }) : NextResponse.json({ error: 'push_not_configured' }, { status: 503 });
}
