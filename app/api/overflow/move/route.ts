import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  // v1.72.1 : capacité centralisée (lib/permissions.ts) au lieu d'une liste
  // de rôles recopiée ici -- mêmes rôles autorisés qu'avant.
  if (!user || !hasCapability(user.role, 'manageOverflow')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { assignment_id, new_reserve_table_id } = await req.json().catch(() => ({}));
  if (!assignment_id || !new_reserve_table_id) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('move_overflow', {
    p_assignment_id: assignment_id,
    p_new_reserve_table_id: new_reserve_table_id,
    p_agent_id: user.id,
  });

  if (error) {
    const status =
      error.message === 'assignment_not_found' || error.message === 'reserve_table_not_found'
        ? 404
        : error.message === 'reserve_table_full' || error.message === 'same_table'
        ? 409
        : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ assignment: data });
}

