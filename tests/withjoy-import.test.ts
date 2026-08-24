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
