import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const bottomNav = readFileSync(new URL('../components/BottomNav.tsx', import.meta.url), 'utf8');
const accountMenu = readFileSync(new URL('../components/AccountMenu.tsx', import.meta.url), 'utf8');
const tablesPage = readFileSync(new URL('../app/tables/page.tsx', import.meta.url), 'utf8');
const scanPage = readFileSync(new URL('../app/scan/page.tsx', import.meta.url), 'utf8');
const scanner = readFileSync(new URL('../components/QrScanner.tsx', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('la navigation principale ouvre directement le plan de table', () => {
  assert.doesNotMatch(bottomNav, /href: ['"]\/tables['"]/);
  assert.match(bottomNav, /href: ['"]\/plan-table['"], label: ['"]Plan['"]/);
  // /scan n'a plus ses propres boutons de navigation dupliques (retour
  // arriere du 30/08/2026, maquette Atrium/Maison : barre du bas partagee
  // avec Recherche/Plan/Bord/Staff, comme les autres ecrans) -- verifie
  // qu'il utilise bien le composant partage plutot que des liens en dur.
  assert.match(scanPage, /<BottomNav role={role} \/>/);
  assert.match(tablesPage, /redirect\(['"]\/plan-table['"]\)/);
});

test('historique et administration sont dans le menu du compte selon les capacites', () => {
  assert.match(accountMenu, /hasCapability\(role, ['"]viewHistory['"]\)/);
  assert.match(accountMenu, /hasCapability\(role, ['"]adminPanel['"]\)/);
  assert.match(accountMenu, /href="\/history"/);
  assert.match(accountMenu, /href="\/admin"/);
  assert.doesNotMatch(bottomNav, /Historique|Admin/);
});

test('le scanner supporte un demontage rapide sans exception non geree', () => {
  assert.match(scanner, /scanner\.isScanning/);
  assert.match(scanner, /try \{/);
  assert.match(scanner, /scannerRef\.current = null/);
});

test('le service worker ignore extensions et origines externes', () => {
  assert.match(serviceWorker, /url\.origin !== self\.location\.origin/);
  assert.match(serviceWorker, /\['http:', 'https:'\]/);
  assert.match(serviceWorker, /Response\.error\(\)/);
});
