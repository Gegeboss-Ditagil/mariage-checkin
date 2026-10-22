import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// v1.84.1 : menu déroulant du rôle illisible (blanc sur blanc) sur /admin/users.
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const usersPage = readFileSync(new URL('../app/admin/users/page.tsx', import.meta.url), 'utf8');

test('menus déroulants : couleurs explicites issues du thème (texte et options), jamais un blanc hérité', () => {
  assert.match(css, /select\s*\{\s*color:\s*var\(--text\);\s*\}/);
  assert.match(css, /select option,\s*select optgroup\s*\{\s*background-color:\s*var\(--bg\);\s*color:\s*var\(--text\);\s*\}/);
});

test('/admin/users : les champs et le menu du rôle ont une couleur de texte explicite', () => {
  const line = usersPage.split('\n').find((l) => l.includes('const inputClass')) ?? '';
  const next = usersPage.split('\n')[usersPage.split('\n').indexOf(line) + 1] ?? '';
  assert.match(line + next, /text-text/);
});

test('tout menu <select> de l\'app a une couleur de texte (classe) ou hérite de la règle globale', () => {
  for (const file of ['app/admin/users/page.tsx', 'app/search/page.tsx', 'app/exceptions/page.tsx']) {
    const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    const blocks = source.split('<select').slice(1).map((part) => part.slice(0, 400));
    assert.ok(blocks.length > 0, file);
    for (const block of blocks) {
      assert.ok(/text-text/.test(block) || /className=\{inputClass\}/.test(block), file + ' : <select> sans couleur de texte');
    }
  }
});
