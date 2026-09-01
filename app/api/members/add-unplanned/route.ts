import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';

// "+ Invité supplémentaire (non prévu)" nommé -- remplace l'ancien "+1"
// anonyme (app/api/checkin/route.ts) pour ce cas précis : la personne
// apparaît dans "Qui est arrivé ?" comme tout le monde, tout en gardant le
// déclenchement de l'assignation de table de réserve en cas de dépassement
// (add_unplanned_arrival ne touche jamais nombre_prevu, voir la migration
// 0030). Même capacité que /api/checkin (checkin), pas manageMembers : tout
// agent qui peut faire l'entrée doit pouvoir logger une arrivée imprévue.
export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'checkin')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { invitation_id, prenom, nom } = await req.json().catch(() => ({}));
  if (!invitation_id || (!String(prenom || '').trim() && !String(nom || '').trim())) {
    return NextResponse.json({ error: "Le nom de l’invité est requis" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('add_unplanned_arrival', {
    p_invitation_id: invitation_id,
    p_prenom: prenom || null,
    p_nom: nom || null,
    p_agent_id: user.id,
  });

  if (error) {
    const status = error.message === 'invitation_not_found' ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ invitation: data });
}
