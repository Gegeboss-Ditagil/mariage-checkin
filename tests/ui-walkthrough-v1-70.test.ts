import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// v1.70.0 -- defauts trouves en parcourant toute l'application dans Chrome
// (preview Vercel, compte admin, mode lecture seule) a la demande de
// Gersom : « clique partout... assure-toi que niveau front-end c'est bon
// partout, un style uniforme liquid glass partout ».
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('/placement : la caméra a une hauteur définie en paysage (elle valait 0 px)', () => {
  const src = read('../app/placement/page.tsx');
  assert.match(src, /<div className="px-4 landscape:flex landscape:h-\[calc\(100svh-9\.5rem\)\] landscape:justify-center">\s*\r?\n\s*<QrScanner onScan=\{resolveByCode\} \/>/);
});

test('/scan : en paysage, la rangée du titre a la hauteur du bouton de compte flottant (il ne couvre plus la caméra)', () => {
  const src = read('../app/scan/page.tsx');
  assert.match(src, /<h1 className="[^"]*landscape:flex landscape:min-h-\[3\.25rem\] landscape:items-center[^"]*">Scanner un QR code<\/h1>/);
});

test('/search : la bascule liste complète / résultats suit une saisie différée (le champ ne gèle plus)', () => {
  const src = read('../app/search/page.tsx');
  assert.match(src, /import \{ Suspense, useDeferredValue, useEffect, useMemo, useState \} from 'react';/);
  assert.match(src, /const deferredQuery = useDeferredValue\(query\);/);
  assert.match(src, /const hasQuery = deferredQuery\.trim\(\)\.length >= /);
  // La requete reseau reste branchee sur la saisie immediate.
  assert.match(src, /\}, \[query, mode\]\);/);
});

test('/plan-table : ouvrir le plan de salle se fait en transition (bouton réactif)', () => {
  const src = read('../app/plan-table/page.tsx');
  assert.match(src, /onClick=\{\(\) => startTransition\(\(\) => setShowFloorPlan\(\(v\) => !v\)\)\}/);
});

test('style uniforme : flèche Retour sur /admin, /history et /exceptions', () => {
  assert.match(read('../app/admin/page.tsx'), /<TopBar title="Administration" backHref="\/dashboard" \/>/);
  assert.match(read('../app/history/page.tsx'), /<TopBar title="Historique" backHref="\/admin" \/>/);
  assert.match(read('../app/exceptions/page.tsx'), /title="Exceptions"\s*\r?\n\s*backHref="\/scan"/);
});

test('style uniforme : actions texte de la barre du haut en pastille de verre (.glass-pill)', () => {
  const css = read('../app/globals.css');
  assert.match(css, /\.glass-pill \{/);
  assert.match(read('../app/exceptions/page.tsx'), /<button type="button" className="glass-pill" onClick=\{\(\) => setShowForm\(\(v\) => !v\)\}>/);
  for (const p of ['../app/tables/[tableId]/page.tsx', '../app/table/[tableId]/page.tsx']) {
    assert.match(read(p), /className="glass-pill"\s*\r?\n\s*>\s*\r?\n\s*\{selectMode \? 'Annuler' : 'Sélectionner'\}/, p);
  }
});

test('style uniforme : /admin/users utilise le crayon en verre (plus de bouton texte « Modifier »)', () => {
  const src = read('../app/admin/users/page.tsx');
  assert.match(src, /import \{ CloseIcon, EditIcon \} from '@\/components\/icons';/);
  assert.match(src, /className="glass-icon-button glass-icon-button-sm"/);
  assert.doesNotMatch(src, /\{editingId === u\.id \? 'Annuler' : 'Modifier'\}/);
});
