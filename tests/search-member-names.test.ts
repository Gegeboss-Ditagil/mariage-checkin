import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { extractPrenoms, extractMembresComplet } from '../lib/membersNotes.ts';

test('extractPrenoms isole le premier prenom de chaque membre depuis la note Membres', () => {
  assert.equal(extractPrenoms('RSVP: Oui | Membres: Karl Isolokele, Ana Isolokele'), 'Karl, Ana');
  assert.equal(extractPrenoms('RSVP: Oui'), null);
  assert.equal(extractPrenoms(null), null);
});

test('extractMembresComplet renvoie le nom complet de chaque membre', () => {
  assert.deepEqual(extractMembresComplet('RSVP: Oui | Membres: Karl Isolokele, Ana Isolokele'), ['Karl Isolokele', 'Ana Isolokele']);
  assert.deepEqual(extractMembresComplet(null), []);
});

test('/plan-table cherche et affiche les prenoms des membres d un groupe', () => {
  const source = readFileSync(new URL('../app/plan-table/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /extractMembresComplet\(inv\.notes\)/);
  assert.match(source, /extractPrenoms\(inv\.notes\)/);
});

test('les fonctions membres ne sont plus dupliquees localement dans les pages', () => {
  const pages = ['app/dashboard/liste/page.tsx', 'app/table/[tableId]/page.tsx', 'app/search/page.tsx', 'app/staff/page.tsx', 'app/tables/[tableId]/page.tsx', 'app/plan-table/page.tsx'];
  for (const page of pages) {
    const source = readFileSync(new URL('../' + page, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /function extractPrenoms/);
    assert.doesNotMatch(source, /function extractMembresComplet/);
    assert.match(source, /from '@\/lib\/membersNotes'/);
  }
});
