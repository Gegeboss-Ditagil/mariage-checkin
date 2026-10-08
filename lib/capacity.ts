import type { InvitationRow, OverflowAssignmentRow, TableRow } from './types';

export interface TableCapacity {
  table: TableRow;
  // Personnes physiquement presentes a cette table en ce moment (vraies
  // arrivees + excedents deja assignes). Jamais une estimation : c'est un
  // decompte de personnes reellement entrees.
  arrivees: number;
  // Ce que la table "occupe" en tenant compte des invites encore attendus
  // (nombre_prevu), MOINS les invitations explicitement marquees "ne viendra
  // pas". C'est la valeur utilisee pour l'avertissement de capacite lors
  // d'une assignation d'excedent.
  occupationEstimee: number;
  // Places physiquement libres maintenant (capacite - arrivees). Toujours
  // exact, ne depend d'aucune estimation ni d'aucun marquage manuel.
  libresMaintenant: number;
  // Places qui devraient rester libres si tous les invites encore attendus
  // (hors "ne viendra pas") se presentent. Peut etre negatif si la table est
  // deja en excedent par rapport a sa capacite reelle -- borne a 0 pour
  // l'affichage.
  libresEstimees: number;
}

/**
 * Calcule, pour chaque table, l'occupation reelle et estimee, en tenant
 * compte des invitations marquees "ne viendra pas" (leurs places prevues ne
 * comptent plus dans l'estimation) et des excedents deja assignes. Utilise a
 * la fois pour l'avertissement de capacite (assignation/deplacement
 * d'excedent) et pour la vue d'ensemble des tables.
 */
export function computeTableCapacities(
  tables: TableRow[],
  invitations: InvitationRow[],
  overflow: OverflowAssignmentRow[]
): TableCapacity[] {
  const arriveesParTable = new Map<string, number>();
  const estimeParTable = new Map<string, number>();

  // v1.73.0 (QA terrain) : l'excedent d'un groupe deja place en reserve
  // etait compte DEUX fois -- a sa table d'origine (nombre_arrive) ET a la
  // table de reserve (overflow_assignments). Constate sur Roger Makongo :
  // table 30 a 11/10 alors que la 11e personne etait assise en table 1.
  // On retire de la table d'origine la part de l'excedent reellement placee
  // ailleurs -- jamais plus que l'excedent actuel (une arrivee annulee apres
  // coup ne fait pas sous-compter la table d'origine).
  const placeAilleursParInvitation = new Map<string, number>();
  for (const o of overflow) {
    if (!o.invitation_id) continue;
    placeAilleursParInvitation.set(o.invitation_id, (placeAilleursParInvitation.get(o.invitation_id) || 0) + o.nombre_personnes);
  }

  for (const inv of invitations) {
    if (!inv.table_id) continue;
    const excedent = Math.max(0, inv.nombre_arrive - inv.nombre_prevu);
    const placeAilleurs = Math.min(placeAilleursParInvitation.get(inv.id) || 0, excedent);
    arriveesParTable.set(inv.table_id, (arriveesParTable.get(inv.table_id) || 0) + inv.nombre_arrive - placeAilleurs);
    // Une invitation marquee "ne viendra pas" ne contribue que ses arrivees
    // reelles (normalement 0) a l'estimation -- ses places prevues sont
    // considerees liberees. Sinon, on prend le plus grand de prevu/arrive
    // (pour ne jamais sous-compter un groupe deja en excedent).
    const contribution = inv.ne_viendra_pas ? inv.nombre_arrive : Math.max(inv.nombre_prevu, inv.nombre_arrive);
    estimeParTable.set(inv.table_id, (estimeParTable.get(inv.table_id) || 0) + contribution - placeAilleurs);
  }

  const overflowParTable = new Map<string, number>();
  for (const o of overflow) {
    overflowParTable.set(o.reserve_table_id, (overflowParTable.get(o.reserve_table_id) || 0) + o.nombre_personnes);
  }

  return tables.map((t) => {
    const overflowIci = overflowParTable.get(t.id) || 0;
    const arrivees = (arriveesParTable.get(t.id) || 0) + overflowIci;
    const occupationEstimee = (estimeParTable.get(t.id) || 0) + overflowIci;
    return {
      table: t,
      arrivees,
      occupationEstimee,
      libresMaintenant: Math.max(0, t.capacity - arrivees),
      libresEstimees: Math.max(0, t.capacity - occupationEstimee),
    };
  });
}

