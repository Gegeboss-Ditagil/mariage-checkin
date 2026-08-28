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
  const rows = Array.from({ length: 420 }, (_, index) => [
    `p${index}`, `Invite${index}`, 'Sature', '', '', 'Oui', 'Côté_Nelly',
  ]);
  const plan = buildImportPlan(parseCsvText(csv(rows)));
  assert.equal(plan.report.unplacedCount, 10);
  assert.equal(plan.report.overCapacity.length, 0);
  assert.equal(plan.tableAssignments.reduce((sum, item) => sum + item.group.size, 0), 410);
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
