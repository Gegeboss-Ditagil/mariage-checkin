// Port serveur des règles validées par scripts/build_plan_from_csv.py et
// scripts/assign_tables_from_labels.py. Ce module ne fait aucune écriture.

export const NB_TABLES_INVITES = 40;
export const NB_TABLES_RESERVE = 1;
export const CAPACITY = 10;
export const CAPACITE_OFFICIELLE = NB_TABLES_INVITES * CAPACITY;

const DECLINED_RSVP = 'Non, nous allons manquer le vol';
const REQUIRED_COLUMNS = ['first name', 'last name', 'party', 'tags'];
const TABLE_TAG_RE = /^[TF](\d{3})$/i;
const PRIORITY_TAGS = [
  'Famille Mbidi DOS',
  'Parents Nelly / Tonton Mbiki',
  'Parents Culumbu',
  'Parents Nelly',
  'Parents Gege',
  'Famille Kumpesa Vemba',
];

function normalizeTag(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();
}

const NO_TABLE_TAGS = new Set(['notable', 'notables', 'sanstable', 'sanstables', 'pasdetable', 'pasdetables', 'needstablegege', 'needstablenelly']);
const NON_ROLE_TAGS = new Set([
  'cotenelly', 'cotegege', 'sms', 'smsgege', 'smsnelly', 'smsaa',
  'smslategege', 'evague', 'maybe', 'amisgege', 'notable', 'notables',
  'sanstable', 'sanstables', 'pasdetable', 'pasdetables', 'needstablegege',
  'needstablenelly', 'parentsculumbu', 'parentsgege', 'parentsnelly',
  'famillekumpesavemba', 'famillembididos', 'parentsnellytontonmbiki',
  'groomsman', 'bridesmaid',
  // Tags administratifs : cortege de mariage ou pense-betes de contact,
  // jamais des roles de staff operationnel.
  'cortege', 'needcontact', 'mail',
]);

export type ImportCote = 'Nelly' | 'Gege' | 'Neutre';
export type PlacementStatus = 'confirmee' | 'provisoire' | 'provisoire_reserve';

export interface ImportGroup {
  gid: string;
  groupe: string | null;
  tags: string[];
  size: number;
  label: string;
  phone: string;
  email: string;
  notes: string;
  cote: ImportCote;
  fixedTable: number | null;
  noTable: boolean;
  category: 'Staff' | null;
  // Vrai seulement si CHAQUE membre du groupe a repondu "Oui" (le texte With
  // Joy reel est "Oui, embarquement confirme" -- prefixe, pas egalite
  // stricte). Determine desormais placementStatus (v1.19.0, demande de
  // Gersom le 28/08/2026) : "confirmee"/"provisoire" reflete la confiance
  // RSVP, plus le fait que la table ait ete assignee via un tag CSV
  // explicite ou par l'algorithme -- ce dernier signal reste disponible
  // (fixedTable !== null) mais ne pilote plus le badge.
  rsvpConfirmed: boolean;
}

export interface TableAssignment {
  tableNumber: number;
  placementStatus: PlacementStatus;
  group: ImportGroup;
}

export interface ImportReport {
  ok: boolean;
  fatalError: string | null;
  groupCount: number;
  personCount: number;
  declinedCount: number;
  withFixedTable: number;
  withoutTable: number;
  toPlaceAutomatically: number;
  unplacedCount: number;
  tablesUsed: number;
  totalTables: number;
  officiellesCount: number;
  reserveCount: number;
  parCote: { Nelly: number; Gege: number; Neutre: number };
  overCapacity: { table: number; used: number }[];
  warnings: string[];
  emptyNameCount: number;
}

export interface ImportPlan {
  report: ImportReport;
  tableAssignments: TableAssignment[];
  sansTable: ImportGroup[];
  unplaced: ImportGroup[];
}

export function parseCsvText(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((candidate) => candidate.some((value) => value.trim()));
  if (!nonEmpty.length) return [];
  const headers = nonEmpty[0].map((header) => header.trim().toLowerCase());
  return nonEmpty.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, (values[index] || '').trim()]))
  );
}

function tagsOf(row: Record<string, string>): string[] {
  return (row.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
}

function tableTagsOf(row: Record<string, string>): number[] {
  return tagsOf(row)
    .map((tag) => TABLE_TAG_RE.exec(tag))
    .filter((match): match is RegExpExecArray => !!match)
    .map((match) => Number(match[1]));
}

function isStaff(tags: string[]): boolean {
  if (tags.some((tag) => normalizeTag(tag) === 'services')) return true;
  return tags.some((tag) => !TABLE_TAG_RE.test(tag) && !NON_ROLE_TAGS.has(normalizeTag(tag)));
}

function coteOf(tags: string[]): ImportCote {
  const normalized = new Set(tags.map(normalizeTag));
  if (normalized.has('cotenelly')) return 'Nelly';
  if (normalized.has('cotegege')) return 'Gege';
  return 'Neutre';
}

function displayName(row: Record<string, string>): string {
  return `${row['first name'] || ''} ${row['last name'] || ''}`.trim() || 'Accompagnant non-nommé';
}

function buildGroup(gid: string, members: Record<string, string>[], warnings: string[]): ImportGroup {
  const tags = Array.from(new Set(members.flatMap(tagsOf)));
  const tableNumbers = members.flatMap(tableTagsOf);
  const distinctTables = Array.from(new Set(tableNumbers));
  if (distinctTables.length > 1) {
    warnings.push(`Groupe « ${gid} » : plusieurs tags de table (${distinctTables.map((n) => `T${String(n).padStart(3, '0')}`).join(', ')}) ; seul le premier est utilisé.`);
  }
  const fixedTable = distinctTables[0] ?? null;
  let noTable = tags.some((tag) => NO_TABLE_TAGS.has(normalizeTag(tag)));
  if (noTable && fixedTable !== null) {
    warnings.push(`Groupe « ${gid} » : tag sans table et tag T${String(fixedTable).padStart(3, '0')} ; le tag de table explicite est prioritaire.`);
    noTable = false;
  }

  const names = members.map(displayName);
  const lastNames = members.map((member) => (member['last name'] || '').trim()).filter(Boolean);
  const dominantLast = lastNames
    .map((name) => ({ name, count: lastNames.filter((candidate) => candidate === name).length }))
    .sort((a, b) => b.count - a.count)[0]?.name || null;
  const label = members.length === 1 ? names[0] : dominantLast ? `Famille ${dominantLast}` : `Groupe (${names[0]}…)`;

  // Signale les noms strictement repetes dans un meme groupe. Cela reste
  // non bloquant (deux homonymes sont possibles), mais evite qu'une ligne
  // dupliquee gonfle silencieusement le nombre prevu. Les accompagnants
  // volontairement non nommes sont une convention legitime et sont exclus.
  const nameCounts = new Map<string, number>();
  for (const member of members) {
    const first = (member['first name'] || '').trim();
    const last = (member['last name'] || '').trim();
    if (!first && !last) continue;
    if (normalizeTag(first) === 'accompagnant' || normalizeTag(last) === 'nonnomme') continue;
    const key = `${first} ${last}`.trim().toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  }
  for (const [key, count] of nameCounts) {
    if (count <= 1) continue;
    const sample = members.find(
      (member) => `${(member['first name'] || '').trim()} ${(member['last name'] || '').trim()}`.trim().toLowerCase() === key
    );
    warnings.push(
      `Groupe « ${label} » : « ${displayName(sample!)} » apparaît ${count} fois avec le même nom — vérifier qu'il ne s'agit pas d'un doublon avant de confirmer (compté ${count}× dans le nombre prévu).`
    );
  }
  const roles = tags.filter((tag) => isStaff([tag]) && normalizeTag(tag) !== 'services');
  const rsvps = Array.from(new Set(members.map((member) => member.rsvp || 'Sans réponse')));
  const rsvpConfirmed = members.every((member) => (member.rsvp || '').trim().startsWith('Oui'));
  const noteParts = [`RSVP: ${rsvps.join(' / ')}`];
  if (tags.some((tag) => normalizeTag(tag) === 'services') || roles.length) {
    noteParts.push(`Rôle: ${[...(tags.some((tag) => normalizeTag(tag) === 'services') ? ['SERVICES'] : []), ...roles].join(', ')}`);
  }
  if (members.length > 1) noteParts.push(`Membres: ${names.join(', ')}`);

  return {
    gid,
    groupe: dominantLast,
    tags,
    size: members.length,
    label,
    phone: members.find((member) => (member['phone number'] || '').trim())?.['phone number'] || '',
    email: members.find((member) => (member.email || '').trim())?.email || '',
    notes: noteParts.join(' | '),
    cote: coteOf(tags),
    fixedTable,
    noTable,
    category: isStaff(tags) ? 'Staff' : null,
    rsvpConfirmed,
  };
}

function parseGroups(rows: Record<string, string>[], warnings: string[]): { groups: ImportGroup[]; declinedCount: number } {
  const parties = new Map<string, Record<string, string>[]>();
  let solo = 0;
  for (const row of rows) {
    const party = (row.party || '').trim() || `SOLO-${++solo}`;
    parties.set(party, [...(parties.get(party) || []), row]);
  }

  let declinedCount = 0;
  const groups: ImportGroup[] = [];
  for (const [party, partyMembers] of parties) {
    const members = partyMembers.filter((member) => {
      const declined = (member.rsvp || '').trim() === DECLINED_RSVP;
      if (declined) declinedCount++;
      return !declined;
    });
    if (!members.length) continue;

    const byTable = new Map<string, Record<string, string>[]>();
    for (const member of members) {
      const numbers = tableTagsOf(member);
      if (numbers.length > 1) {
        warnings.push(`${displayName(member)} porte plusieurs tags de table ; seul le premier est utilisé.`);
      }
      const key = numbers.length ? String(numbers[0]) : 'none';
      byTable.set(key, [...(byTable.get(key) || []), member]);
    }

    for (const [tableKey, sameTableMembers] of byTable) {
      const staffMembers = sameTableMembers.filter((member) => isStaff(tagsOf(member)));
      const nonStaffMembers = sameTableMembers.filter((member) => !isStaff(tagsOf(member)));
      staffMembers.forEach((member, index) => groups.push(buildGroup(`${party}-${tableKey}-STAFF-${index + 1}`, [member], warnings)));
      if (nonStaffMembers.length) groups.push(buildGroup(`${party}-${tableKey}`, nonStaffMembers, warnings));
    }
  }
  return { groups, declinedCount };
}

function clusterKey(group: ImportGroup): string {
  return PRIORITY_TAGS.find((tag) => group.tags.includes(tag)) || `Côté_${group.cote}`;
}

function emptyPlan(error: string): ImportPlan {
  return {
    report: {
      ok: false, fatalError: error, groupCount: 0, personCount: 0, declinedCount: 0,
      withFixedTable: 0, withoutTable: 0, toPlaceAutomatically: 0, unplacedCount: 0,
      tablesUsed: 0, totalTables: 41, officiellesCount: 0, reserveCount: 0,
      parCote: { Nelly: 0, Gege: 0, Neutre: 0 }, overCapacity: [], warnings: [], emptyNameCount: 0,
    },
    tableAssignments: [], sansTable: [], unplaced: [],
  };
}

export function buildImportPlan(rows: Record<string, string>[]): ImportPlan {
  if (!rows.length) return emptyPlan('Le fichier est vide ou illisible.');
  const missing = REQUIRED_COLUMNS.filter((column) => !(column in rows[0]));
  if (missing.length) return emptyPlan(`Colonnes manquantes : ${missing.join(', ')}.`);

  const warnings: string[] = [];
  const parsed = parseGroups(rows, warnings);
  const allGroups = parsed.groups;
  const totalTables = NB_TABLES_INVITES + NB_TABLES_RESERVE;
  const tableUsed = new Map<number, number>(Array.from({ length: totalTables }, (_, index) => [index + 1, 0]));
  const assignments: TableAssignment[] = [];
  const sansTable = allGroups.filter((group) => group.noTable);
  const fixed = allGroups.filter((group) => !group.noTable && group.fixedTable !== null);
  const labeledTables = new Set(fixed.map((group) => group.fixedTable!).filter((table) => table >= 1 && table <= totalTables));
  const overflow: ImportGroup[] = [];
  const unplaced: ImportGroup[] = [];

  for (const group of fixed) {
    const table = group.fixedTable!;
    if (table < 1 || table > totalTables) {
      warnings.push(`${group.label} : table T${table} hors de la plage 1-${totalTables}.`);
      unplaced.push(group);
    } else if ((tableUsed.get(table) || 0) + group.size <= CAPACITY) {
      tableUsed.set(table, (tableUsed.get(table) || 0) + group.size);
      assignments.push({ tableNumber: table, placementStatus: group.rsvpConfirmed ? 'confirmee' : 'provisoire', group });
    } else {
      warnings.push(`${group.label} ne tient pas à la table ${table} et passe dans le placement provisoire.`);
      overflow.push(group);
    }
  }

  const automatic = allGroups.filter((group) => !group.noTable && group.fixedTable === null);
  const clusters = new Map<string, ImportGroup[]>();
  for (const group of [...automatic, ...overflow]) {
    const key = clusterKey(group);
    clusters.set(key, [...(clusters.get(key) || []), group]);
  }
  const pool = Array.from({ length: NB_TABLES_INVITES }, (_, index) => index + 1).filter((table) => !labeledTables.has(table));
  const reserve = [NB_TABLES_INVITES + 1];
  const clusterEntries = Array.from(clusters.entries()).sort((a, b) =>
    b[1].reduce((sum, group) => sum + group.size, 0) - a[1].reduce((sum, group) => sum + group.size, 0)
  );

  for (const [, clusterGroups] of clusterEntries) {
    for (const group of [...clusterGroups].sort((a, b) => b.size - a.size)) {
      const table = [...pool, ...reserve].find((candidate) => CAPACITY - (tableUsed.get(candidate) || 0) >= group.size);
      if (!table) {
        unplaced.push(group);
        warnings.push(`${group.label} (${group.size}) ne tient sur aucune table disponible.`);
        continue;
      }
      tableUsed.set(table, (tableUsed.get(table) || 0) + group.size);
      assignments.push({
        tableNumber: table,
        // Le placement (table choisie par l'algorithme vs tag CSV explicite)
        // ne pilote plus ce statut -- seule la confiance RSVP compte
        // desormais. Le fait d'etre en reserve reste visible ailleurs via
        // table_id + tables.is_reserve (voir /plan-table), inchange.
        placementStatus: group.rsvpConfirmed ? 'confirmee' : 'provisoire',
        group,
      });
    }
  }

  const parCote = { Nelly: 0, Gege: 0, Neutre: 0 };
  allGroups.forEach((group) => { parCote[group.cote] += group.size; });
  const overCapacity = Array.from(tableUsed.entries()).filter(([, used]) => used > CAPACITY).map(([table, used]) => ({ table, used }));
  const officiellesCount = Array.from(tableUsed.entries()).filter(([table]) => table <= NB_TABLES_INVITES).reduce((sum, [, used]) => sum + used, 0);
  const reserveCount = tableUsed.get(NB_TABLES_INVITES + 1) || 0;

  return {
    report: {
      ok: true,
      fatalError: null,
      groupCount: allGroups.length,
      personCount: allGroups.reduce((sum, group) => sum + group.size, 0),
      declinedCount: parsed.declinedCount,
      withFixedTable: assignments.filter((assignment) => assignment.placementStatus === 'confirmee').length,
      withoutTable: sansTable.reduce((sum, group) => sum + group.size, 0),
      toPlaceAutomatically: automatic.length + overflow.length,
      unplacedCount: unplaced.reduce((sum, group) => sum + group.size, 0),
      tablesUsed: Array.from(tableUsed.values()).filter(Boolean).length,
      totalTables,
      officiellesCount,
      reserveCount,
      parCote,
      overCapacity,
      warnings,
      emptyNameCount: allGroups.filter((group) => group.label === 'Accompagnant non-nommé').length,
    },
    tableAssignments: assignments,
    sansTable,
    unplaced,
  };
}
