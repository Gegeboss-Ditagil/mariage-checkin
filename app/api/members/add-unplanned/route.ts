import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';

// "+ Invité supplémentaire (non prévu)" nommé -- remplace l'ancien "+1"
// anonyme (app/api/checkin/route.ts) pour ce cas précis : la personne
// apparaît dans "Qui est arrivé ?" comme tout le monde, tout en gardant le
// déclenchement de l'assignation de table de réserve en cas de dépassement
// (add_unplanned_arrival ne touche jamais nombre_prevu, voir la migration
// 0030).
//
// Capacité resserrée le 02/09/2026 (retour de Gersom : "si les scanners
// scannent, vous dites vous êtes quatre mais dans l'invitation il y a deux,
// ils ne vont même pas traiter votre demande... c'est les placeurs qui vont
// gérer le reste, car ils auront les bons accès") -- exigeait `checkin`
// (donc accessible à agent_checkin) ; exige désormais `submitGuestApproval`,
// la même capacité que le nouveau parcours photo lié (0046) et que /scan :
// un excédent de personnes ne se traite plus jamais au comptoir/scan, il
// remonte systématiquement à un placeur/directeur/admin. Le check-in normal
// (`set-arrival-status`, marquer présents des invités déjà prévus) reste
// inchangé pour tout le monde.
export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'submitGuestApproval')) {
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
