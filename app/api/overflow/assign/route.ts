import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !['admin', 'agent_checkin'].includes(user.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { invitation_id, reserve_table_id, nombre_personnes } = await req.json().catch(() => ({}));
  if (!invitation_id || !reserve_table_id || typeof nombre_personnes !== 'number' || nombre_personnes <= 0) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('assign_overflow', {
    p_invitation_id: invitation_id,
    p_reserve_table_id: reserve_table_id,
    p_nombre_personnes: nombre_personnes,
    p_agent_id: user.id,
  });

  if (error) {
    const status = error.message === 'reserve_table_full' ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ assignment: data });
}
