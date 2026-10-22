import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushTest } from '@/lib/webPush';

// v1.84.0 : « Envoyer une notification de test » -- aux seuls appareils du
// compte connecté. Même droit que l'abonnement (viewGuestApprovals).
export async function POST() {
  const user = await getSessionUser();
  if (!user || !hasCapability(user.role, 'viewGuestApprovals')) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const result = await sendPushTest(createAdminClient(), { id: user.id, event_id: user.event_id });
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
}
