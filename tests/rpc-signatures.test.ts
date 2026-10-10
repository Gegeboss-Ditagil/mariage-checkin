import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// v1.75.0, analyse « pourquoi nos tests n'ont pas vu ces erreurs » : la fonction
// assign_table_to_guest_approval_strict existait en DEUX versions (0038 sans
// p_force, 0049 avec). lib/guestApprovalDecide.ts l'appelait avec 3 arguments,
// ce qui correspondait aux deux : Postgres refusait (« function is not
// unique »), l'erreur était ignorée, et l'invité approuvé restait sans table.
//
// Ce test rejoue les migrations du dépôt (create / drop function, dans
// l'ordre) pour connaître les versions vivantes de chaque fonction, puis
// vérifie que CHAQUE appel .rpc(...) du code correspond à exactement UNE
// version (arguments nommés connus, arguments obligatoires présents).

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

interface Param {
  name: string;
  type: string;
  hasDefault: boolean;
}

function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = false;
  let current = '';
  for (const ch of text) {
    if (ch === "'") quote = !quote;
    if (!quote && ch === '(') depth += 1;
    if (!quote && ch === ')') depth -= 1;
    if (!quote && depth === 0 && ch === ',') {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function normalizeType(type: string): string {
  return type.toLowerCase().replace(/\s+/g, ' ').trim().replace(/^int$/, 'integer').replace(/^int4$/, 'integer');
}

export function parseParams(list: string): Param[] {
  return splitTopLevel(list).map((raw) => {
    const text = raw.replace(/^(in|out|inout)\s+/i, '');
    const defaultMatch = text.match(/\s(default|=)\s/i);
    const head = defaultMatch ? text.slice(0, defaultMatch.index) : text;
    const [name, ...typeParts] = head.trim().split(/\s+/);
    return { name: name.toLowerCase(), type: normalizeType(typeParts.join(' ')), hasDefault: !!defaultMatch };
  });
}

export function liveFunctionSignatures(sqlFiles: string[]): Map<string, Map<string, Param[]>> {
  const live = new Map<string, Map<string, Param[]>>();
  const statement = /(create\s+(?:or\s+replace\s+)?function|drop\s+function\s+(?:if\s+exists\s+)?)\s*(?:public\.)?([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*(returns|;|cascade|restrict)/gi;
  for (const sql of sqlFiles) {
    const clean = sql.replace(/--[^\n]*/g, '');
    for (const match of clean.matchAll(statement)) {
      const isDrop = /^drop/i.test(match[1]);
      const name = match[2].toLowerCase();
      if (isDrop) {
        // drop function f(uuid, text) ou f(p_a uuid, p_b text) : on garde le type.
        const types = splitTopLevel(match[3]).map((t) => {
          const tokens = t.trim().split(/\s+/);
          return normalizeType(tokens.length > 1 && /^p_/i.test(tokens[0]) ? tokens.slice(1).join(' ') : t);
        });
        live.get(name)?.delete(types.join(','));
        continue;
      }
      const params = parseParams(match[3]);
      const key = params.map((p) => p.type).join(',');
      if (!live.has(name)) live.set(name, new Map());
      live.get(name)!.set(key, params);
    }
  }
  return live;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === 'node_modules' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

export function rpcCalls(source: string): { name: string; keys: string[] }[] {
  const calls: { name: string; keys: string[] }[] = [];
  const call = /\.rpc\(\s*'([a-z0-9_]+)'\s*(?:,\s*\{([\s\S]*?)\}\s*\))?/g;
  for (const match of source.matchAll(call)) {
    const body = match[2] ?? '';
    const keys = Array.from(body.matchAll(/\b(p_[a-z0-9_]+)\b\s*(?=[:,}]|$)/g)).map((m) => m[1]);
    calls.push({ name: match[1], keys: Array.from(new Set(keys)) });
  }
  return calls;
}

function acceptedBy(params: Param[], keys: string[]): boolean {
  const names = new Set(params.map((p) => p.name));
  return keys.every((k) => names.has(k)) && params.every((p) => p.hasDefault || keys.includes(p.name));
}

const migrationsDir = join(ROOT, 'supabase', 'migrations');
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), 'utf8'));
const live = liveFunctionSignatures(migrations);

test('chaque appel .rpc() du code correspond à exactement UNE version de la fonction SQL', () => {
  const files = [...sourceFiles(join(ROOT, 'app')), ...sourceFiles(join(ROOT, 'lib'))];
  let checked = 0;
  for (const file of files) {
    for (const { name, keys } of rpcCalls(readFileSync(file, 'utf8'))) {
      const versions = live.get(name);
      assert.ok(versions && versions.size > 0, `${file}: ${name} n'est créée par aucune migration`);
      const matching = Array.from(versions.values()).filter((params) => acceptedBy(params, keys));
      assert.equal(
        matching.length,
        1,
        `${file}: ${name}(${keys.join(', ')}) correspond à ${matching.length} version(s) -- ${matching.length > 1 ? 'appel ambigu (function is not unique)' : 'aucune signature compatible'}`
      );
      checked += 1;
    }
  }
  assert.ok(checked >= 28, 'au moins 28 appels RPC vérifiés, trouvé ' + checked);
});

test('régression v1.75.0 : 0069 supprime l’ancienne version à 4 paramètres de la fonction de placement', () => {
  const versions = live.get('assign_table_to_guest_approval_strict')!;
  assert.equal(versions.size, 1);
  assert.deepEqual(Array.from(versions.values())[0].map((p) => p.name), ['p_request_id', 'p_table_id', 'p_agent_id', 'p_relocations', 'p_force']);
  // Avant 0069, l'appel à 3 arguments de lib/guestApprovalDecide.ts aurait
  // correspondu aux deux versions : on le prouve en rejouant sans 0069.
  const before = liveFunctionSignatures(migrations.filter((sql) => !sql.includes('app_health_report')));
  const old = Array.from(before.get('assign_table_to_guest_approval_strict')!.values());
  assert.equal(old.filter((params) => acceptedBy(params, ['p_request_id', 'p_table_id', 'p_agent_id'])).length, 2);
});

test('le parseur reconnaît paramètres obligatoires, valeurs par défaut et arguments nommés', () => {
  const params = parseParams("p_a uuid, p_b jsonb default '[]'::jsonb, p_c boolean = false");
  assert.deepEqual(params.map((p) => [p.name, p.type, p.hasDefault]), [
    ['p_a', 'uuid', false],
    ['p_b', 'jsonb', true],
    ['p_c', 'boolean', true],
  ]);
  assert.deepEqual(rpcCalls(".rpc('f', { p_a: x ? y : z, p_b, })")[0].keys, ['p_a', 'p_b']);
});
