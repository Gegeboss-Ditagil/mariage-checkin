import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'checkin')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { invitation_id, nombre_personnes } = await req.json().catch(() => ({}));
  if (!invitation_id || typeof nombre_personnes !== 'number' || nombre_personnes <= 0) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('record_checkin', {
    p_invitation_id: invitation_id,
    p_agent_id: user.id,
    p_nombre_personnes: nombre_personnes,
    p_is_correction: false,
    p_absolute_total: null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ invitation: data });
}
