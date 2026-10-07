import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { TABLE_SEAT_NAMES } from '../lib/floorPlanSeats.ts';

// v1.71.2 -- « supprime Cedrix » ; « Ya Maguy est en réalité Celestina
// Mundanda Nsita » (doublon : même téléphone, même groupe With Joy).
const sql = readFileSync(new URL('../supabase/migrations/0065_remove_cedrix_merge_ya_maguy.sql', import.meta.url), 'utf8');

test('migration 0065 : sauvegarde avant toute écriture, suppressions gardées par des garde-fous', () => {
  assert.ok(sql.indexOf('insert into import_backups') < sql.indexOf('delete from'), 'la sauvegarde précède les suppressions');
  assert.match(sql, /'kind', 'v1\.71\.2_cedrix_maguy'/);
  // Cedrix : seulement le faux invité surprise sans arrivée.
  assert.match(sql, /nom_affichage = 'Cedrix'\s*\n\s*and notes like 'Invité surprise approuvé%' and nombre_arrive = 0;/);
  // Ya Maguy : seulement la fiche doublon (même téléphone + même groupe).
  assert.match(sql, /nom_affichage = 'Ya Maguy Mundanda Nsita'\s*\n\s*and telephone = '\+41789610804' and withjoy_party_id = 'table-028-party-166'/);
  // Aucune autre table touchée (audit conservé via SET NULL).
  assert.doesNotMatch(sql, /delete from (audit_logs|tables|checkins)/);
});

test('prénom With Joy complet « Maguy Celestina » repris sur la famille et le siège du plan', () => {
  assert.match(sql, /'Membres: Maguy Celestina Mundanda Nsita,'/);
  assert.equal(TABLE_SEAT_NAMES[28][0], 'Maguy Celestina Mundanda Nsita');
});
