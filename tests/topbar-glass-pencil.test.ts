import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// v1.69.3, retour de Gersom (capture d'ecran /checkin, « Ahicam Damuna ✎ ») :
// « J'aime pas l'icône... j'aurais voulu que ça garde plus le style liquid
// glass... c'est circulaire... c'est dans un cercle. Juste le crayon comme
// ça, c'est laid. » Le glyphe texte ✎ devient EditIcon dans une pastille
// ronde en verre (.glass-icon-button + .glass-icon-button-sm).
const topBar = readFileSync(new URL('../components/TopBar.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('TopBar : le crayon de renommage est une icône dans un cercle liquid glass, plus le glyphe ✎', () => {
  assert.match(topBar, /import \{ EditIcon \} from '@\/components\/icons';/);
  assert.match(topBar, /<span aria-hidden className="glass-icon-button glass-icon-button-sm">\s*<EditIcon className="h-4 w-4" \/>/);
  // Le glyphe seul ne doit plus etre rendu (il ne subsiste que dans le commentaire).
  assert.doesNotMatch(topBar, />✎</);
  assert.doesNotMatch(topBar, /text-sm text-accent">✎/);
  // Toujours un vrai bouton accessible, libelle explicite.
  assert.match(topBar, /aria-label=\{'Modifier « ' \+ title \+ ' »'\}/);
});

test('globals.css : variante compacte .glass-icon-button-sm définie après .glass-icon-button', () => {
  const base = css.indexOf('.glass-icon-button {');
  const sm = css.indexOf('.glass-icon-button-sm {');
  assert.ok(base >= 0 && sm > base, 'la variante doit suivre la classe de base pour la surcharger');
  assert.match(css.slice(sm, sm + 80), /@apply h-8 w-8;/);
});

test('/checkin/[invitationId]/members : même crayon liquid glass pour renommer un membre', () => {
  const members = readFileSync(new URL('../app/checkin/[invitationId]/members/page.tsx', import.meta.url), 'utf8');
  assert.match(members, /className="glass-icon-button glass-icon-button-sm"\s*\r?\n\s*onClick=\{\(\) => startEdit\(g\)\}/);
  assert.match(members, /<EditIcon className="h-4 w-4" \/>/);
  assert.doesNotMatch(members, /✎/);
});
