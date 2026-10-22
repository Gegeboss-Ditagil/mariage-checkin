import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// v1.85.2 : retours de Gersom sur le compte de Rémy (directeur).

test('/admin/users : titre et contenu neutres tant que le rôle n’est pas connu, comptes triés A→Z', () => {
  const page = read('app/admin/users/page.tsx');
  assert.match(page, /const \[loaded, setLoaded\] = useState\(false\)/);
  assert.match(page, /\.finally\(\(\) => setLoaded\(true\)\)/);
  assert.match(page, /title=\{!loaded \? 'Comptes'/);
  assert.match(page, /\{!loaded \? \(/);
  assert.match(page, /localeCompare\(b\.nom_affichage, "fr", \{ sensitivity: "base" \}\)/);
  assert.match(page, /\{sortedUsers\.map\(\(u\) =>/);
  assert.doesNotMatch(page, /\{users\.map\(\(u\) =>/);
});

test('ordre alphabétique : accents et casse ignorés', () => {
  const names = ['Rémy Landu', 'agent001', 'Éloïse B', 'Eloise A', 'Zoé'];
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  assert.deepEqual(sorted, ['agent001', 'Eloise A', 'Éloïse B', 'Rémy Landu', 'Zoé']);
});

test('écran « Bienvenue » : fondu vers le fond puis une seule navigation', () => {
  const login = read('app/login/page.tsx');
  assert.match(login, /const navigated = useRef\(false\)/);
  assert.match(login, /if \(!nextHref \|\| navigated\.current\) return;/);
  assert.match(login, /leaving \? 'bg-bg text-text' : 'bg-status-complete text-white'/);
  assert.match(login, /onClick=\{goNext\}/);
  assert.equal((login.match(/router\.replace\(nextHref\)/g) ?? []).length, 1, 'une seule navigation vers nextHref');
});
