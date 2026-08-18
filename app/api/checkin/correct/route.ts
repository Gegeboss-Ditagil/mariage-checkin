import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

/** Corrige le nombre TOTAL de personnes arrivées pour une invitation (valeur absolue). */
export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !['admin', 'agent_checkin', 'placeur'].includes(user.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { invitation_id, nouveau_total } = await req.json().catch(() => ({}));
  if (!invitation_id || typeof nouveau_total !== 'number' || nouveau_total < 0) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('record_checkin', {
    p_invitation_id: invitation_id,
    p_agent_id: user.id,
    p_nombre_personnes: 0,
    p_is_correction: true,
    p_absolute_total: nouveau_total,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ invitation: data });
}
