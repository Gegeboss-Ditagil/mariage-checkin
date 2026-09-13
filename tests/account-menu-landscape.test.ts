import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Retour de Gersom le 13/09/2026 (capture d'écran, /scan tourné en
// paysage) : "les deux SS qui vont par-dessus le bouton recherche" -- le
// bouton de compte flottant (`AccountMenu floating`, utilisé via
// `components/UserMenu.tsx` sur /scan et /placement, les deux seuls écrans
// sans TopBar) restait ancré en haut à DROITE du viewport (`fixed right-4
// top-4`) quelle que soit l'orientation, alors qu'en paysage la barre de
// navigation devient une bande verticale collée à ce même bord droit
// (`components/BottomNav.tsx`, `landscape:w-20`) : les deux se
// superposaient, recouvrant le premier onglet (Recherche). L'usage non
// flottant (TopBar) n'a jamais ce problème : son conteneur est déjà calé à
// droite de la colonne de contenu (flex), qui laisse elle-même la place à
// la bande de navigation dans les deux orientations.
const accountMenu = readFileSync(new URL('../components/AccountMenu.tsx', import.meta.url), 'utf8');

test("le bouton de compte flottant bascule a gauche en paysage (uniquement dans ce mode), pour ne plus se superposer a la bande de navigation verticale de droite", () => {
  assert.match(
    accountMenu,
    /floating\s*\n\s*\? 'fixed right-4 top-4 z-30 landscape:right-auto landscape:left-\[calc\(1rem\+env\(safe-area-inset-left\)\)\]'\s*\n\s*: 'relative z-30'/
  );
});

test("le panneau deroulant du compte s'ouvre vers la droite en paysage flottant (sinon ses 16rem de large partiraient hors ecran vers la gauche), inchange en variante non flottante", () => {
  assert.match(accountMenu, /floating \? 'right-0 landscape:right-auto landscape:left-0' : 'right-0'/);
});

test("la banniere \"Nouvelle approbation\" (meme composant) s'arrete avant la bande de navigation verticale en paysage, au lieu de passer dessous", () => {
  const alertBlock = accountMenu.slice(accountMenu.indexOf('approvalAlert &&'), accountMenu.indexOf('</Link>'));
  assert.match(alertBlock, /landscape:left-\[calc\(1rem\+env\(safe-area-inset-left\)\)\]/);
  assert.match(alertBlock, /landscape:right-\[calc\(5rem\+env\(safe-area-inset-right\)\+0\.75rem\)\]/);
});
