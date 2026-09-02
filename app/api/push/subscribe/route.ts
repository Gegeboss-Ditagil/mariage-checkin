import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  // Les placeurs doivent pouvoir s'abonner pour recevoir l'assignation apres
  // la décision, même s'ils n'ont pas le droit d'approuver/refuser.
  if (!user || !hasCapability(user.role, 'viewGuestApprovals')) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const subscription = await req.json().catch(() => null);
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (![endpoint, p256dh, auth].every((value) => typeof value === 'string' && value.length > 0)) {
    return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { data: event } = await supabase.from('events').select('id').eq('id', user.event_id).maybeSingle();
  if (!event) return NextResponse.json({ error: 'event_not_found' }, { status: 400 });
  const { error } = await supabase.from('push_subscriptions').upsert({
    event_id: event.id,
    user_id: user.id,
    endpoint,
    p256dh,
    auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
}
