import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// v1.77.0, demande de Gersom (« corrige l'écart entre le dépôt et la
// production ») : 11 migrations du dépôt avaient été appliquées à la main sans
// trace, deux jamais appliquées (0041, 0047), et l'historique de production
// mélangeait deux numérotations. Chaque fichier doit désormais dire son état
// en production dans docs/MIGRATIONS_PRODUCTION.md.

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const files = readdirSync(join(ROOT, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql')).sort();
const doc = readFileSync(join(ROOT, 'docs', 'MIGRATIONS_PRODUCTION.md'), 'utf8');

test('chaque migration du dépôt a son état en production documenté', () => {
  const missing = files.filter((f) => !doc.includes('`' + f + '`'));
  assert.deepEqual(missing, [], 'ajouter ces fichiers à docs/MIGRATIONS_PRODUCTION.md avec leur état en production');
});

test('la documentation ne cite aucune migration qui n’existe plus dans le dépôt', () => {
  const cited = Array.from(doc.matchAll(/`(\d{4}_[a-z0-9_]+\.sql)`/g)).map((m) => m[1]);
  assert.deepEqual(cited.filter((f) => !files.includes(f)), []);
});

test('le script manuel de 0069 contient bien la migration, l’historique et une sauvegarde avant nettoyage', () => {
  const manual = readFileSync(join(ROOT, 'supabase', 'manual', '2026-10-10_appliquer_0069_et_nettoyer_historique.sql'), 'utf8');
  const migration = readFileSync(join(ROOT, 'supabase', 'migrations', '0069_health_report_reset_fix_strict_overload.sql'), 'utf8');
  const body = migration.slice(migration.indexOf('drop function if exists'));
  assert.ok(manual.includes(body.trim()), 'le script manuel doit reprendre 0069 à l’identique');
  assert.ok(manual.indexOf('schema_migrations_backup_20261010') < manual.indexOf('delete from supabase_migrations.schema_migrations'), 'sauvegarde avant suppression');
  assert.match(manual, /^begin;$/m);
  assert.match(manual, /^commit;$/m);
});
