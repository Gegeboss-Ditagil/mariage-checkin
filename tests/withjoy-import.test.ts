import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildImportPlan, parseCsvText } from '../lib/withjoyImport.ts';

function csv(rows: string[][]): string {
  return [
    ['party', 'first name', 'last name', 'phone number', 'email', 'rsvp', 'tags'],
    ...rows,
  ].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
}

test('CSV BOM, guillemets et tags F/T sont lus sans perte', () => {
  const rows = parseCsvText('\uFEFF' + csv([['p1', 'Ana', 'Dos', '', '', 'Oui', 'Côté_Nelly,F004']]));
  const plan = buildImportPlan(rows);
  assert.equal(plan.report.ok, true);
  assert.equal(plan.tableAssignments[0].tableNumber, 4);
  assert.equal(plan.tableAssignments[0].placementStatus, 'confirmee');
});

test('RSVP décliné est exclu et le foyer restant est conservé', () => {
  const plan = buildImportPlan(parseCsvText(csv([
    ['p1', 'Ana', 'Dos', '', '', 'Non, nous allons manquer le vol', 'Côté_Nelly'],
    ['p1', 'Bob', 'Dos', '', '', 'Oui', 'Côté_Nelly'],
  ])));
  assert.equal(plan.report.declinedCount, 1);
  assert.equal(plan.report.personCount, 1);
  assert.equal(plan.tableAssignments[0].group.label, 'Bob Dos');
});

test('staff est individualisé, cortège et Needs_Table ne deviennent pas Staff', () => {
  const plan = buildImportPlan(parseCsvText(csv([
    ['p1', 'Roger', 'Landu', '+1', '', 'Oui', 'SERVICES,Côté_Gege,T030'],
    ['p1', 'Nadine', 'Landu', '', '', 'Oui', 'Côté_Gege,T030'],
    ['p2', 'Herve', 'Menga', '', '', 'Oui', 'Groomsman,Côté_Gege'],
    ['p3', 'Mika', 'Fleurival', '', '', 'Oui', 'Needs_Table_Gege,Côté_Gege'],
  ])));
  const groups = [...plan.tableAssignments.map((item) => item.group), ...plan.sansTable];
  const byName = new Map(groups.map((group) => [group.label, group]));
  assert.equal(byName.get('Roger Landu')?.category, 'Staff');
  assert.equal(byName.get('Nadine Landu')?.category, null);
  assert.equal(byName.get('Herve Menga')?.category, null);
  assert.equal(byName.get('Mika Fleurival')?.category, null);
  assert.equal(byName.get('Mika Fleurival')?.noTable, true);
});

test('tag explicite gagne sur sans-table et un double tag produit un warning', () => {
  const plan = buildImportPlan(parseCsvText(csv([
    ['p1', 'DJ', 'Test', '', '', 'Oui', 'notable,T005,T006'],
  ])));
  assert.equal(plan.sansTable.length, 0);
  assert.equal(plan.tableAssignments[0].tableNumber, 5);
  assert.match(plan.report.warnings.join('\n'), /plusieurs tags de table/);
  assert.match(plan.report.warnings.join('\n'), /prioritaire/);
});

test('une capacité totale dépassée bloque au lieu de surcharger une table', () => {
  // 42 tables (41 officielles + 1 réserve) x 10 places = 420 au total
  // (v1.47.0, table 41 "Houston" devenue régulière + nouvelle réserve 42
  // "Johannesburg" -- avant cette date, capacité totale = 41 x 10 = 410).
  const rows = Array.from({ length: 430 }, (_, index) => [
    `p${index}`, `Invite${index}`, 'Sature', '', '', 'Oui', 'Côté_Nelly',
  ]);
  const plan = buildImportPlan(parseCsvText(csv(rows)));
  assert.equal(plan.report.unplacedCount, 10);
  assert.equal(plan.report.overCapacity.length, 0);
  assert.equal(plan.tableAssignments.reduce((sum, item) => sum + item.group.size, 0), 420);
});

test('Cortege/Need_Contact/Mail restent synchronises entre import CSV, ajout manuel et script Python', () => {
  const migrationSource = readFileSync(new URL('../supabase/migrations/0027_sync_non_role_tags_cortege_contact_mail.sql', import.meta.url), 'utf8');
  assert.match(migrationSource, /'Cortege','Cortège','Need_Contact','Mail'/);
  const pythonSource = readFileSync(new URL('../scripts/build_plan_from_csv.py', import.meta.url), 'utf8');
  assert.match(pythonSource, /"Cortege"/);
  assert.match(pythonSource, /"Need_Contact"/);
  assert.match(pythonSource, /"Mail"/);
});

test('Cortege, Need_Contact et Mail ne rendent jamais quelqu un Staff', () => {
  const plan = buildImportPlan(parseCsvText(csv([
    ['p1', 'Jean', 'Dupont', '', '', 'Oui', 'Côté_Gege,F001,Cortege'],
    ['p2', 'Marie', 'Curie', '', '', 'Oui', 'Côté_Nelly,T005,Need_Contact'],
    ['p3', 'Ana', 'Silva', '', '', 'Oui', 'Côté_Nelly,T006,Mail'],
  ])));
  const groups = [...plan.tableAssignments.map((item) => item.group), ...plan.sansTable];
  const byName = new Map(groups.map((group) => [group.label, group]));
  assert.equal(byName.get('Jean Dupont')?.category, null);
  assert.equal(byName.get('Marie Curie')?.category, null);
  assert.equal(byName.get('Ana Silva')?.category, null);
});

test('une meme personne repetee dans un groupe declenche un avertissement, jamais les accompagnants sans nom', () => {
  const plan = buildImportPlan(parseCsvText(csv([
    ['p1', 'Keziah', 'Malungu', '+1', '', 'Oui', 'Côté_Gege,T015'],
    ['p1', 'Ruben', 'Malungu', '', '', 'Oui', 'Côté_Gege,T015'],
    ['p1', 'Keziah', 'Malungu', '+1', '', 'Oui', 'Côté_Gege,T015'],
    ['p2', 'Famille', 'Culumbu', '', '', 'Oui', 'Côté_Gege,F007'],
    ['p2', 'Accompagnant', 'non-nommé', '', '', 'Oui', 'Côté_Gege,F007'],
    ['p2', 'Accompagnant', 'non-nommé', '', '', 'Oui', 'Côté_Gege,F007'],
  ])));
  const joined = plan.report.warnings.join('\n');
  assert.match(joined, /« Keziah Malungu » apparaît 2 fois/);
  assert.doesNotMatch(joined, /Accompagnant non-nommé/);
});

test('des lignes completement sans nom sont comptees et signalees (emptyNameCount)', () => {
  const plan = buildImportPlan(parseCsvText(csv([
    ['p1', '', '', '', '', 'Oui', 'Côté_Gege,T010'],
    ['p2', '', '', '', '', 'Oui', 'Côté_Nelly,T011'],
  ])));
  assert.equal(plan.report.emptyNameCount, 2);
  const source = readFileSync(new URL('../app/admin/import-withjoy/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /report\.emptyNameCount > 0/);
  assert.match(source, /report\.emptyNameCount === 0/);
});

test('placement_status suit desormais la confiance RSVP, plus le fait que la table soit un tag explicite ou auto-assignee', () => {
  // v1.19.0 (28/08/2026, demande explicite de Gersom) : avant cette
  // version, un tag T0xx/F0xx explicite suffisait a rendre confirmee, sans
  // egard au RSVP. Le vrai texte With Joy est "Oui, embarquement confirme"
  // -- prefixe, jamais une egalite stricte avec "Oui".
  const plan = buildImportPlan(parseCsvText(csv([
    ['p1', 'Ana', 'Dos', '', '', 'Oui, embarquement confirmé', 'Côté_Nelly,T010'],
    ['p2', 'Bob', 'Fils', '', '', 'Peut-être, on verra', 'Côté_Nelly,T011'],
    ['p3', 'Cara', 'Neige', '', '', '', 'Côté_Nelly,T012'],
    ['p4', 'Dan', 'Roc', '', '', 'Oui, embarquement confirmé', 'Côté_Nelly'],
    ['p5', 'Eve', 'Sable', '', '', 'Peut-être, on verra', 'Côté_Nelly'],
    ['p6', 'Finn', 'Terre', '', '', 'Oui, embarquement confirmé', 'Côté_Nelly'],
    ['p6', 'Gia', 'Terre', '', '', 'Peut-être, on verra', 'Côté_Nelly'],
  ])));
  const byLabel = new Map(plan.tableAssignments.map((a) => [a.group.label, a.placementStatus]));
  assert.equal(byLabel.get('Ana Dos'), 'confirmee'); // tag explicite + RSVP Oui -> confirmee
  assert.equal(byLabel.get('Bob Fils'), 'provisoire'); // tag explicite mais RSVP Peut-être -> provisoire desormais
  assert.equal(byLabel.get('Cara Neige'), 'provisoire'); // tag explicite mais aucune reponse RSVP -> provisoire
  assert.equal(byLabel.get('Dan Roc'), 'confirmee'); // sans tag (auto-assigne) mais RSVP Oui -> confirmee quand meme
  assert.equal(byLabel.get('Eve Sable'), 'provisoire'); // sans tag et RSVP Peut-être -> provisoire
  assert.equal(byLabel.get('Famille Terre'), 'provisoire'); // groupe mixte (un Oui, un Peut-être) -> provisoire
});

test('un party vide n agrege jamais deux personnes sans lien entre elles', () => {
  const plan = buildImportPlan(parseCsvText(csv([
    ['', 'Alice', 'Martin', '', '', 'Oui', 'Côté_Gege'],
    ['', 'Bob', 'Durand', '', '', 'Oui', 'Côté_Nelly'],
  ])));
  const labels = [...plan.tableAssignments.map((item) => item.group), ...plan.sansTable].map((group) => group.label);
  assert.ok(labels.includes('Alice Martin'));
  assert.ok(labels.includes('Bob Durand'));
  assert.equal(plan.report.groupCount, 2);
});

test('route et migration gardent le remplacement réservé et atomique', () => {
  const route = readFileSync(new URL('../app/api/admin/import-withjoy/route.ts', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../supabase/migrations/0026_import_replace_invitations.sql', import.meta.url), 'utf8');
  assert.match(route, /user\.role !== 'admin'/);
  assert.match(route, /confirmation !== 'REMPLACER'/);
  assert.match(route, /event\.status !== 'setup'/);
  assert.match(route, /p_expected_before_count/);
  assert.match(route, /p_expected_fingerprint/);
  assert.match(migration, /revoke all on table import_backups from public, anon, authenticated/i);
  assert.match(migration, /revoke all on function admin_replace_invitations[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /import_source_changed/);
  assert.match(migration, /admin_import_invitations_state/);
  assert.match(migration, /digest\(/);
  assert.match(migration, /returning id into v_backup_id/);
});

// v1.48.6, demande de Gersom le 14/09/2026 : "assure-toi que chaque siege a
// son id et fait match avec l'invite id" -- analyse de guest-list_50.csv :
// la colonne "party" de With Joy (ex. "table-002-party-006") reste stable
// pour la meme personne entre deux exports (verifie sur guest-list_48.csv et
// guest-list_50.csv, Pajos Mpapa), contrairement au nom -- utile pour
// retrouver la meme invitation lors d'un futur import. Le "table-XXX" qu'elle
// contient parfois NE correspond PAS forcement a la vraie table (seulement
// ~1/3 des groupes de guest-list_50.csv concordaient avec le vrai tag F0xx/
// T0xx) : jamais une source de placement, uniquement un identifiant de
// correspondance -- voir migration 0052 et le commentaire sur
// ImportGroup.withjoyPartyId dans lib/withjoyImport.ts.
test('la valeur brute de la colonne "party" With Joy est conservee comme identifiant stable (withjoyPartyId), jamais parsee comme un numero de table', () => {
  const plan = buildImportPlan(parseCsvText(csv([
    ['table-002-party-006', 'Pajos', 'Mpapa', '', '', 'Oui', 'Côté_Gege,F006'],
  ])));
  assert.equal(plan.report.ok, true);
  assert.equal(plan.tableAssignments[0].group.withjoyPartyId, 'table-002-party-006');
  // La vraie table vient du tag F006, jamais du "table-002" du party.
  assert.equal(plan.tableAssignments[0].tableNumber, 6);
});

test('un party vide (ligne SOLO synthetique) ne produit jamais un faux identifiant With Joy', () => {
  const plan = buildImportPlan(parseCsvText(csv([
    ['', 'Alice', 'Martin', '', '', 'Oui', 'Côté_Gege'],
  ])));
  assert.equal(plan.tableAssignments.length + plan.sansTable.length, 1);
  const group = plan.tableAssignments[0]?.group || plan.sansTable[0];
  assert.equal(group.withjoyPartyId, null);
});

test('un meme party With Joy scinde en plusieurs invitations (staff + famille) garde le meme withjoyPartyId sur chacune', () => {
  const plan = buildImportPlan(parseCsvText(csv([
    ['fam-042', 'Alice', 'Martin', '', '', 'Oui', 'Côté_Gege,F005'],
    ['fam-042', 'Bob', 'Martin', '', '', 'Oui', 'Côté_Gege,F005,SERVICES'],
  ])));
  const groups = [...plan.tableAssignments.map((item) => item.group), ...plan.sansTable];
  assert.equal(groups.length, 2, 'staff et non-staff doivent rester deux invitations separees');
  assert.ok(groups.every((group) => group.withjoyPartyId === 'fam-042'));
});

test("l'import complet (route + migration 0052) ecrit withjoy_party_id, sans jamais le deduire du numero de table", () => {
  const route = readFileSync(new URL('../app/api/admin/import-withjoy/route.ts', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../supabase/migrations/0052_invitations_withjoy_party_id.sql', import.meta.url), 'utf8');
  assert.match(route, /withjoy_party_id: group\.withjoyPartyId/);
  assert.match(migration, /alter table invitations add column if not exists withjoy_party_id text;/);
  assert.match(migration, /withjoy_party_id\s*\)/);
  assert.match(migration, /nullif\(trim\(v_row->>'withjoy_party_id'\), ''\)/);
  // Le garde-fou documente explicitement pourquoi ce champ n'est pas une
  // source de placement -- verrouille pour qu'un futur agent ne le
  // reintroduise pas silencieusement comme tel.
  assert.match(migration, /jamais une source de placement/);
});
