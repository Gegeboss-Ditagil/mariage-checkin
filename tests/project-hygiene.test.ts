import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

// v1.75.0 (point 7 de l'analyse) : des éléments « vieux » pointaient vers des
// fichiers absents (npm run seed / reset-test-data) sans que rien ne le
// signale. Garde-fous simples sur l'état du dépôt.

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('chaque script npm pointe vers un fichier qui existe', () => {
  for (const [name, command] of Object.entries(pkg.scripts as Record<string, string>)) {
    for (const match of command.matchAll(/((?:scripts|tests)\/[\w./-]+\.(?:ts|js|py))/g)) {
      assert.ok(existsSync(new URL('../' + match[1], import.meta.url)), `npm run ${name} : ${match[1]} introuvable`);
    }
  }
  assert.equal(pkg.scripts.test, 'node --test tests/*.test.ts');
});

test('les migrations sont numérotées sans trou ni doublon (une migration oubliée se voit)', () => {
  const numbers = readdirSync(new URL('../supabase/migrations/', import.meta.url))
    .filter((f) => f.endsWith('.sql'))
    .map((f) => Number(f.slice(0, 4)));
  const unique = new Set(numbers);
  assert.equal(unique.size, numbers.length, 'deux migrations portent le même numéro');
  const max = Math.max(...numbers);
  const missing = Array.from({ length: max }, (_, i) => i + 1).filter((n) => !unique.has(n) && n !== 18);
  assert.deepEqual(missing, [], 'numéros manquants');
});

test('chaque migration appliquée hors historique Supabase est vérifiée par le contrôle de santé', () => {
  // 0038/0040/0047/0049 n'apparaissent pas dans supabase_migrations : leurs
  // objets sont vérifiés en base par app_health_report (0069).
  const migration = readFileSync(new URL('../supabase/migrations/0069_health_report_reset_fix_strict_overload.sql', import.meta.url), 'utf8');
  for (const fn of ['assign_table_to_guest_approval_strict', 'ensure_invitation_member_rows', 'reset_test_event_data']) {
    assert.match(migration, new RegExp("'" + fn + "'"));
  }
});
