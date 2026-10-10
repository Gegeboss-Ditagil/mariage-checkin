import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// v1.75.0 : le contrôle de santé (app_health_report, migration 0069) ne vaut
// que si sa liste de fonctions suit le code. Ce test échoue dès qu'un nouvel
// appel .rpc('x') apparaît sans que 'x' soit ajouté à la liste vérifiée en base
// -- c'est ainsi qu'une migration jamais appliquée (0047) est restée
// invisible : rien ne vérifiait la base elle-même.

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const migration = readFileSync(join(ROOT, 'supabase/migrations/0069_health_report_reset_fix_strict_overload.sql'), 'utf8');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

const calledByCode = new Set(
  [...files(join(ROOT, 'app')), ...files(join(ROOT, 'lib'))].flatMap((f) =>
    Array.from(readFileSync(f, 'utf8').matchAll(/\.rpc\(\s*'([a-z0-9_]+)'/g)).map((m) => m[1])
  )
);
calledByCode.delete('app_health_report');

const listed = new Set(
  Array.from((migration.match(/v_expected_functions text\[\] := array\[([\s\S]*?)\];/) ?? ['', ''])[1].matchAll(/'([a-z0-9_]+)'/g)).map((m) => m[1])
);

test('le contrôle de santé vérifie TOUTES les fonctions SQL appelées par le code', () => {
  const missing = [...calledByCode].filter((name) => !listed.has(name));
  assert.deepEqual(missing, [], 'à ajouter à v_expected_functions (0069) : ' + missing.join(', '));
  const stale = [...listed].filter((name) => !calledByCode.has(name));
  assert.deepEqual(stale, [], 'plus appelées par le code, à retirer : ' + stale.join(', '));
});

test('le contrôle couvre les règles de données qui ont déjà cassé en production', () => {
  for (const check of [
    'lignes nominatives <= places',
    'aucune table en surcapacité',
    'aucun doublon de personne entre invitations',
    'aucune demande approuvée réservée sans table',
    "compteur d''arrivées = personnes cochées",
    'réserves = tables 1 et 42',
    'contrainte decided_via accepte app',
  ]) {
    assert.ok(migration.includes(check), 'contrôle manquant : ' + check);
  }
  // Lecture seule : aucune écriture dans app_health_report.
  const body = migration.slice(migration.indexOf('create or replace function app_health_report'));
  assert.doesNotMatch(body, /\b(insert|update|delete)\s/i);
  assert.match(body, /language plpgsql stable/);
});

test('reset_test_event_data remet aussi le pointage par personne à zéro (sinon compteurs et coches divergent)', () => {
  const reset = migration.slice(migration.indexOf('create or replace function reset_test_event_data'), migration.indexOf('create or replace function app_health_report'));
  assert.match(reset, /raise exception 'event_live'/);
  assert.match(reset, /set arrival_status = 'attendu'/);
  assert.match(reset, /g\.is_unplanned/);
  assert.match(reset, /set nombre_arrive = 0/);
});

test('/api/admin/health est réservé à l’admin et /admin affiche la carte « Santé de la base »', () => {
  const route = readFileSync(join(ROOT, 'app/api/admin/health/route.ts'), 'utf8');
  assert.match(route, /hasCapability\(user\.role, 'adminPanel'\)/);
  assert.match(route, /rpc\('app_health_report'\)/);
  const page = readFileSync(join(ROOT, 'app/admin/page.tsx'), 'utf8');
  assert.match(page, /Santé de la base/);
  assert.match(page, /fetch\('\/api\/admin\/health'/);
});
