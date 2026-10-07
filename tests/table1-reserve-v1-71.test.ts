import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// v1.71.0 (migration 0064), demande de Gersom : « la table 42 n'existe plus,
// appeler table 1 Maquela do Zombo la table excédentaire maintenant -- 42 est
// supprimé et table 1 reste mais elle est vide pour l'excédentaire (corriger
// et mettre à jour dans l'app partout) ». Décision confirmée : la ligne 42
// reste en base (13 lignes d'audit de septembre la référencent) mais est
// désactivée (capacité 0) et masquée dans toutes les listes de l'app.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('migration 0064 : table 1 réserve, 42 désactivée, Luzolo -> 31, Steven retiré, Roger Makongo ajouté, avec sauvegarde', () => {
  const sql = read('../supabase/migrations/0064_table1_reserve_hide_table42_makongo_luzolo.sql');
  assert.match(sql, /insert into import_backups/);
  assert.match(sql, /'kind', 'v1\.71\.0_table1_reserve'/);
  assert.match(sql, /update tables set is_reserve = true\s*\n\s*where id = v_t1/);
  assert.match(sql, /set is_reserve = false, capacity = 0, label = 'Supprimee \(historique audit uniquement\)'/);
  assert.match(sql, /nom_affichage = 'Luzolo Patrick Menga'/);
  assert.match(sql, /set table_id = v_t31/);
  assert.match(sql, /set nombre_prevu = 3,\s*\n\s*notes = replace\(notes, 'Steven Kimbau, ', ''\)/);
  assert.match(sql, /'Roger Makongo', 1, '\+33745986455'/);
  // Idempotente : chaque ecriture est gardee par une condition.
  assert.match(sql, /if not exists \(select 1 from invitations where event_id = v_event and nom_affichage = 'Roger Makongo'\)/);
  // Jamais de DELETE (audit preserve).
  assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
});

test('la table 42 désactivée (capacité 0) est masquée de toutes les listes de tables', () => {
  const files = [
    '../app/api/admin/tables/route.ts',
    '../app/api/admin/wizard-status/route.ts',
    '../app/approbations/[id]/assign/page.tsx',
    '../app/checkin/[invitationId]/page.tsx',
    '../app/dashboard/liste/page.tsx',
    '../app/dashboard/page.tsx',
    '../app/placement/page.tsx',
    '../app/plan-table/page.tsx',
    '../app/search/page.tsx',
    '../app/tables/add/page.tsx',
    '../app/tables/move/[invitationId]/page.tsx',
    '../app/tables/move-guest/[guestId]/page.tsx',
    '../app/tables/move-multiple/page.tsx',
    '../app/tables/overflow/[assignmentId]/page.tsx',
    '../lib/exports.ts',
    '../lib/guestApprovalNotify.ts',
  ];
  for (const f of files) {
    assert.match(read(f), /\.gt\('capacity', 0\)/, f + ' doit filtrer les tables désactivées');
  }
});

test('capacités affichées : 400 places officielles, réserves = tables 1 et 42 (v1.72.0)', () => {
  assert.match(read('../app/plan-table/page.tsx'), /const CAPACITE_OFFICIELLE = 400;/);
  const importPage = read('../app/admin/import-withjoy/page.tsx');
  assert.match(importPage, /\/ 400 places officielles/);
  assert.match(importPage, /en réserve \(tables 1 et 42, excédentaires\)/);
  const seats = read('../lib/floorPlanSeats.ts');
  assert.match(seats, /^\s*42: \[null, null, null, null, null, null, null, null, null, null\],/m);
  assert.match(seats, /"Rémy Landu", "Roger Makongo"\]/);
  assert.match(seats, /"Claudine Pello", "Luzolo Patrick Menga"/);
});

test('connectivité réduite : les lectures Supabase du navigateur ont un délai maximal (jamais « Chargement… » infini)', () => {
  const src = read('../lib/supabase/client.ts');
  assert.match(src, /export const SUPABASE_READ_TIMEOUT_MS = 15_000;/);
  assert.match(src, /AbortSignal\.timeout\?\.\(SUPABASE_READ_TIMEOUT_MS\)/);
  assert.match(src, /typeof AbortSignal\.any === 'function'/);
  assert.match(src, /\{ global: \{ fetch: fetchWithTimeout \} \}/);
  // Toujours un singleton par onglet (v1.40.0).
  assert.match(src, /if \(!client\) \{/);
});
