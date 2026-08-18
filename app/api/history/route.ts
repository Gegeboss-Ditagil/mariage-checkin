import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

export async function GET() {
  const user = getSessionUser();
  if (!user || !['admin', 'agent_checkin', 'placeur'].includes(user.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select(
      'id, action, created_at, nombre_personnes, ancien_total, nouveau_total, details, ' +
      'table:table_id(number), reserve_table:reserve_table_id(number), ' +
      'agent:agent_id(nom_affichage)'
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const entries = (data || []).map((row: any) => ({
    id: row.id,
    action: row.action,
    created_at: row.created_at,
    nombre_personnes: row.nombre_personnes,
    ancien_total: row.ancien_total,
    nouveau_total: row.nouveau_total,
    details: row.details,
    table_number: row.table?.number ?? null,
    reserve_table_number: row.reserve_table?.number ?? null,
    agent_name: row.agent?.nom_affichage ?? null,
  }));

  return NextResponse.json({ entries });
}
