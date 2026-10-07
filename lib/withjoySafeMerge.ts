// « Mise à jour sûre » d'un export With Joy (v1.71.0) -- demande de Gersom :
// « assure-toi qu'un import With Joy de dernière minute à partir de l'app
// directement fonctionnera bien ». L'import complet (admin_replace_invitations)
// REMPLACE tout et remet les arrivées à zéro : il est donc refusé en mode
// live. Ce module calcule, sans aucune écriture, ce qu'un export de dernière
// minute APPORTE de nouveau, en ne touchant jamais à l'existant :
//   * personnes absentes de la base -> ajoutées (à leur table T/Fxxx si elle a
//     encore la place, sinon dans la réserve -- table 1 --, sinon sans table) ;
//   * personnes déjà présentes mais dont le tag de table a changé -> SIGNALÉES
//     seulement (un déplacement reste un geste manuel dans l'app, qui gère
//     déjà les arrivées et la capacité) ;
//   * aucune suppression, aucune remise à zéro, aucune modification de fiche.
// Pur et déterministe (testé dans tests/withjoy-safe-merge.test.ts).

import { RESERVE_TABLE_NUMBER, type ImportGroup, type ImportPlan } from './withjoyImport.ts';

export interface ExistingInvitation {
  id: string;
  nom_affichage: string;
  notes: string | null;
  withjoy_party_id: string | null;
  table_number: number | null;
}

export interface TableLoad {
  number: number;
  capacity: number;
  used: number;
}

export interface SafeAddition {
  group: ImportGroup;
  tableNumber: number | null;
  // Pourquoi cette table : tag du CSV respecté, réserve faute de place, ou
  // sans table (ni la table demandée ni la réserve n'ont la place).
  reason: 'tag' | 'reserve' | 'sans_table';
}

export interface SafeTableChange {
  label: string;
  invitationName: string;
  fromTable: number | null;
  toTable: number;
}

// Personne au nom inconnu MAIS dont le groupe With Joy (party) existe deja
// en base : tres probablement une personne renommee dans With Joy (constate
// sur guest-list (63).csv : « Accompagnateur Amy Eliano » devenu « Artiste
// Amy Eliano »). Jamais ajoutee automatiquement (doublon) -- listee pour
// verification manuelle.
export interface SafeReview {
  label: string;
  size: number;
  existingInvitationName: string;
}

export interface SafeMergePlan {
  additions: SafeAddition[];
  toReview: SafeReview[];
  tableChanges: SafeTableChange[];
  alreadyPresent: number;
  addedPersons: number;
}

// Clé de comparaison tolérante : casse, accents, ponctuation et espaces
// multiples ignorés (« Rémy  Landu » == « remy landu »).
export function personKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Noms connus d'une invitation : son nom affiché + la liste « Membres: »
// écrite dans notes par l'import (même format que buildGroup).
export function knownNamesOf(invitation: Pick<ExistingInvitation, 'nom_affichage' | 'notes'>): string[] {
  const names = [invitation.nom_affichage];
  const match = (invitation.notes || '').match(/Membres:\s*([^|]+)/);
  if (match) names.push(...match[1].split(',').map((name) => name.trim()).filter(Boolean));
  return names;
}

export function buildSafeMergePlan(plan: ImportPlan, existing: ExistingInvitation[], tables: TableLoad[]): SafeMergePlan {
  const invitationByPerson = new Map<string, ExistingInvitation>();
  const invitationByParty = new Map<string, ExistingInvitation>();
  for (const invitation of existing) {
    for (const name of knownNamesOf(invitation)) {
      const key = personKey(name);
      // « Accompagnant non-nommé » n'identifie personne : jamais une clé.
      if (key && !key.startsWith('accompagn')) invitationByPerson.set(key, invitation);
    }
    if (invitation.withjoy_party_id) invitationByParty.set(invitation.withjoy_party_id, invitation);
  }

  const load = new Map(tables.map((table) => [table.number, { ...table }]));
  const additions: SafeAddition[] = [];
  const toReview: SafeReview[] = [];
  const tableChanges: SafeTableChange[] = [];
  let alreadyPresent = 0;

  const groups = [...plan.tableAssignments.map((assignment) => assignment.group), ...plan.sansTable, ...plan.unplaced];
  const seen = new Set<string>();
  for (const group of groups) {
    if (seen.has(group.gid)) continue;
    seen.add(group.gid);
    const named = group.memberNames.filter((name) => !personKey(name).startsWith('accompagn'));
    const matches = named.map((name) => invitationByPerson.get(personKey(name))).filter(Boolean) as ExistingInvitation[];
    const sameParty = group.withjoyPartyId ? invitationByParty.get(group.withjoyPartyId) : undefined;
    const present = matches.length > 0 || (!!sameParty && named.length === 0);
    if (!present && sameParty) {
      toReview.push({ label: group.label, size: group.size, existingInvitationName: sameParty.nom_affichage });
      continue;
    }

    if (present) {
      alreadyPresent += 1;
      if (group.fixedTable !== null && !group.noTable) {
        const reported = new Set<string>();
        for (const invitation of matches) {
          if (invitation.table_number !== group.fixedTable && !reported.has(invitation.id)) {
            reported.add(invitation.id);
            tableChanges.push({
              label: group.label,
              invitationName: invitation.nom_affichage,
              fromTable: invitation.table_number,
              toTable: group.fixedTable,
            });
          }
        }
      }
      continue;
    }

    // Nouvelle personne : table du tag si elle a encore la place, sinon
    // réserve (table 1), sinon sans table -- jamais au-delà de la capacité.
    const fits = (number: number | null) => {
      if (number === null) return false;
      const table = load.get(number);
      return !!table && table.capacity > 0 && table.capacity - table.used >= group.size;
    };
    let tableNumber: number | null = null;
    let reason: SafeAddition['reason'] = 'sans_table';
    if (!group.noTable && fits(group.fixedTable)) {
      tableNumber = group.fixedTable;
      reason = 'tag';
    } else if (!group.noTable && fits(RESERVE_TABLE_NUMBER)) {
      tableNumber = RESERVE_TABLE_NUMBER;
      reason = 'reserve';
    }
    if (tableNumber !== null) load.get(tableNumber)!.used += group.size;
    additions.push({ group, tableNumber, reason });
  }

  return {
    additions,
    toReview,
    tableChanges,
    alreadyPresent,
    addedPersons: additions.reduce((sum, addition) => sum + addition.group.size, 0),
  };
}
