// v1.74.0, retour de Gersom (capture de la table 1, tous les sièges « Vide »
// alors que Sergio y est placé) : « si je mets quelqu'un sur les tables 1 et
// 42 à travers l'application, parce que c'est un invité surprise ou un ajout,
// [...] on va voir le nom de la personne sur le siège [...] ainsi que son nom
// en haut et sur l'image de la table ».
//
// Jusqu'ici le dessin de chaque table lisait UNIQUEMENT `TABLE_SEAT_NAMES`
// (export figé du PDF seatplan.io) : une personne placée ensuite par
// l'application (invité surprise approuvé, excédent envoyé en réserve,
// déplacement) n'y apparaissait jamais, et une personne déplacée restait
// dessinée à son ancienne table. Ce module construit les sièges à partir des
// VRAIES données (invitations.table_id, guests, overflow_assignments) :
//   1. un siège du PDF est gardé à sa place s'il correspond à une personne
//      réellement placée à cette table (l'ordre photographié reste stable) ;
//   2. sinon il est libéré (personne partie, déplacée ou retirée) ;
//   3. chaque personne réellement placée mais absente du PDF prend le premier
//      siège libre, puis des sièges supplémentaires si la table déborde.
// Purement de l'affichage : rien n'est jamais écrit en base.

import { TABLE_SEAT_NAMES, namesMatch } from './floorPlanSeats.ts';
import { extractMembresComplet } from './membersNotes.ts';
import type { GuestArrivalStatus, InvitationRow, OverflowAssignmentRow } from './types';

export interface LiveSeatGuest {
  nom_affichage: string;
  arrival_status: GuestArrivalStatus;
  is_unplanned: boolean;
  created_at: string;
}

export type LiveSeatInvitation = Pick<
  InvitationRow,
  'id' | 'nom_affichage' | 'notes' | 'nombre_prevu' | 'nombre_arrive' | 'ne_viendra_pas'
>;

/** Une personne assise : son nom affiché et l'invitation à laquelle elle appartient. */
export interface LiveSeatPerson {
  name: string;
  invitationId: string;
}

export type LiveSeatOverflow = Pick<OverflowAssignmentRow, 'id' | 'invitation_id' | 'nombre_personnes' | 'created_at'>;

/** Libellé d'un excédent dont on ne connaît pas le nom individuel. */
export function overflowPlaceholder(invitationName: string): string {
  return 'Excédent · ' + invitationName;
}

function sortedGuests(guests: LiveSeatGuest[] | undefined): LiveSeatGuest[] {
  return [...(guests || [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Noms des personnes d'une invitation, dans l'ordre : lignes nominatives
 * (hors « ne viendra pas ») si elles existent, sinon les membres importés
 * (« Membres: ... »), sinon le nom de l'invitation. Complété jusqu'au nombre
 * de personnes attendues/arrivées par « Invité de … » (jamais un nom deviné).
 */
export function invitationPeopleNames(inv: LiveSeatInvitation, guests: LiveSeatGuest[] | undefined): string[] {
  if (inv.ne_viendra_pas && inv.nombre_arrive === 0) return [];
  const rows = sortedGuests(guests);
  const members = extractMembresComplet(inv.notes);
  const expected = Math.max(inv.nombre_prevu, inv.nombre_arrive);
  if (rows.length > 0) {
    // Certaines invitations gardent plus de lignes nominatives que de places
    // prévues (ex. Famille Malungu : 5 lignes pour nombre_prevu = 2, après la
    // scission de v1.68.1) -- nombre_prevu/nombre_arrive font foi. Priorité
    // aux arrivés, puis aux noms de « Membres: ... », puis aux plus anciens.
    const rank = (g: LiveSeatGuest) =>
      g.arrival_status === 'arrive' ? 0 : members.some((m) => namesMatch(m, g.nom_affichage)) ? 1 : 2;
    const present = rows.filter((g) => g.arrival_status !== 'ne_viendra_pas');
    const kept = new Set([...present].sort((a, b) => rank(a) - rank(b)).slice(0, expected));
    return present.filter((g) => kept.has(g)).map((g) => g.nom_affichage);
  }
  const names = members.length > 0 ? [...members] : [inv.nom_affichage];
  while (names.length < expected) names.push('Invité de ' + inv.nom_affichage);
  return names;
}

/**
 * Pour UNE invitation, répartit ses excédents placés en réserve entre ses
 * affectations (overflow_assignments, plus ancienne d'abord) : les personnes
 * ajoutées sur place (`is_unplanned`) puis les dernières arrivées partent en
 * réserve en premier. Si le nom n'est pas connu, « Excédent · <invitation> ».
 */
export function overflowNamesByAssignment(
  inv: LiveSeatInvitation,
  guests: LiveSeatGuest[] | undefined,
  assignments: LiveSeatOverflow[]
): Map<string, string[]> {
  const candidates = sortedGuests(guests)
    .filter((g) => g.arrival_status === 'arrive')
    .sort((a, b) => Number(b.is_unplanned) - Number(a.is_unplanned) || b.created_at.localeCompare(a.created_at))
    .map((g) => g.nom_affichage);
  const result = new Map<string, string[]>();
  let next = 0;
  for (const a of [...assignments].sort((x, y) => x.created_at.localeCompare(y.created_at))) {
    const names: string[] = [];
    for (let i = 0; i < a.nombre_personnes; i += 1) {
      names.push(next < candidates.length ? candidates[next] : overflowPlaceholder(inv.nom_affichage));
      next += 1;
    }
    result.set(a.id, names);
  }
  return result;
}

/**
 * Noms des personnes réellement assises à une table : ses invitations (moins
 * leurs excédents envoyés ailleurs) + les excédents d'autres tables placés
 * ici. `invitationsById`/`guestsByInvitation` doivent couvrir les invitations
 * de la table ET celles d'origine des excédents reçus.
 */
export function tablePeopleNames(params: {
  tableInvitationIds: string[];
  invitationsById: Map<string, LiveSeatInvitation>;
  guestsByInvitation: Map<string, LiveSeatGuest[]>;
  // Toutes les affectations d'excédent qui concernent ces invitations (en
  // partance) ou cette table (reçues).
  overflow: LiveSeatOverflow[];
  // Ids des affectations reçues par CETTE table.
  incomingOverflowIds: Set<string>;
}): LiveSeatPerson[] {
  const { tableInvitationIds, invitationsById, guestsByInvitation, overflow, incomingOverflowIds } = params;
  const byInvitation = new Map<string, LiveSeatOverflow[]>();
  for (const o of overflow) {
    byInvitation.set(o.invitation_id, [...(byInvitation.get(o.invitation_id) || []), o]);
  }
  const namesByAssignment = new Map<string, string[]>();
  for (const [invitationId, assignments] of byInvitation) {
    const inv = invitationsById.get(invitationId);
    if (!inv) continue;
    for (const [id, names] of overflowNamesByAssignment(inv, guestsByInvitation.get(invitationId), assignments)) {
      namesByAssignment.set(id, names);
    }
  }

  const people: LiveSeatPerson[] = [];
  for (const invitationId of tableInvitationIds) {
    const inv = invitationsById.get(invitationId);
    if (!inv) continue;
    const names = invitationPeopleNames(inv, guestsByInvitation.get(invitationId));
    // Retire une seule fois chaque personne partie en réserve (jamais plus).
    for (const o of byInvitation.get(invitationId) || []) {
      if (incomingOverflowIds.has(o.id)) continue;
      for (const gone of namesByAssignment.get(o.id) || []) {
        const idx = names.findIndex((n) => namesMatch(n, gone));
        if (idx !== -1) names.splice(idx, 1);
        else if (names.length > 0) names.pop();
      }
    }
    people.push(...names.map((name) => ({ name, invitationId })));
  }
  for (const o of overflow) {
    if (!incomingOverflowIds.has(o.id)) continue;
    people.push(...(namesByAssignment.get(o.id) || []).map((name) => ({ name, invitationId: o.invitation_id })));
  }
  return people;
}

/**
 * Sièges à dessiner pour une table : ordre du PDF gardé pour les personnes
 * toujours présentes, sièges libérés pour les absents, nouvelles personnes
 * dans les premiers sièges libres, sièges ajoutés si la table déborde.
 */
export function buildLiveSeats(
  tableNumber: number,
  people: LiveSeatPerson[],
  capacity: number
): (LiveSeatPerson | null)[] {
  const photographed = TABLE_SEAT_NAMES[tableNumber] || [];
  const size = Math.max(photographed.length, capacity, 1);
  const seats: (LiveSeatPerson | null)[] = Array.from({ length: size }, () => null);
  const remaining = [...people];
  photographed.forEach((name, idx) => {
    if (!name) return;
    const match = remaining.findIndex((p) => namesMatch(p.name, name));
    if (match === -1) return;
    seats[idx] = remaining[match];
    remaining.splice(match, 1);
  });
  for (const person of remaining) {
    const free = seats.indexOf(null);
    if (free === -1) seats.push(person);
    else seats[free] = person;
  }
  return seats;
}

/** Noms seuls, pour TableSeatWheel (`null` = siège vide). */
export function liveSeatNames(seats: (LiveSeatPerson | null)[]): (string | null)[] {
  return seats.map((seat) => (seat ? seat.name : null));
}

/** Sièges occupés par une invitation donnée. */
export function seatIndicesForInvitation(seats: (LiveSeatPerson | null)[], invitationId: string): number[] {
  return seats.flatMap((seat, idx) => (seat && seat.invitationId === invitationId ? [idx] : []));
}

/** Même comparaison exacte que findSeatIndexByName, sur des sièges vivants. */
export function findLiveSeatIndexByName(seats: (LiveSeatPerson | null)[], name: string): number | null {
  const index = seats.findIndex((seat) => seat !== null && namesMatch(seat.name, name));
  return index === -1 ? null : index;
}

/** Sièges du PDF tels quels (repli tant que les vraies données chargent). */
export function photographedSeats(tableNumber: number, capacity: number): (LiveSeatPerson | null)[] {
  const photographed = TABLE_SEAT_NAMES[tableNumber] || [];
  const size = Math.max(photographed.length, capacity, 1);
  return Array.from({ length: size }, (_, idx) => {
    const name = photographed[idx];
    return name ? { name, invitationId: '' } : null;
  });
}

/**
 * v1.74.0 : chaises pleines/vides d'une table. Garde le motif du PDF, puis
 * l'ajuste au nombre réel de personnes placées : libère les dernières
 * chaises si la table s'est vidée, remplit les chaises vides (et en ajoute
 * si elle déborde) quand quelqu'un y a été placé depuis l'application.
 */
export function floorPlanChairs(photographed: (string | null)[], occupied: number | undefined): boolean[] {
  const filled = photographed.map((name) => name !== null);
  if (occupied === undefined) return filled;
  if (filled.length === 0) filled.push(...Array.from({ length: 10 }, () => false));
  let count = filled.filter(Boolean).length;
  for (let i = filled.length - 1; i >= 0 && count > occupied; i -= 1) {
    if (filled[i]) {
      filled[i] = false;
      count -= 1;
    }
  }
  for (let i = 0; i < filled.length && count < occupied; i += 1) {
    if (!filled[i]) {
      filled[i] = true;
      count += 1;
    }
  }
  while (count < occupied) {
    filled.push(true);
    count += 1;
  }
  return filled;
}
