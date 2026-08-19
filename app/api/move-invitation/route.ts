import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !['admin', 'directeur', 'placeur'].includes(user.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { invitation_id, new_table_id } = await req.json().catch(() => ({}));
  if (!invitation_id || !new_table_id) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('move_invitation_table', {
    p_invitation_id: invitation_id,
    p_new_table_id: new_table_id,
    p_agent_id: user.id,
  });

  if (error) {
    const status =
      error.message === 'invitation_not_found' || error.message === 'table_not_found'
        ? 404
        : error.message === 'same_table'
        ? 409
        : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ invitation: data });
}

