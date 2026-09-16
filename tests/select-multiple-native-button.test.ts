import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// v1.53.17, retour de Gersom (capture d'écran de /tables/[tableId]) : "le
// bouton sélectionner plusieurs invités n'aurait jamais été comme ça dans
// un iPhone" -- un lien texte souligné (`underline underline-offset-2`) est
// une convention web (hyperlien), jamais un bouton iOS natif. Devient un
// vrai bouton texte dans la barre de navigation (TopBar `right`), sans
// soulignement -- même emplacement/style que "Select"/"Cancel" dans Photos
// ou Mail sur iOS. Corrigé sur les deux routes maintenues en parallèle
// (/tables/[tableId] et l'ancienne /table/[tableId]).

const sites = ['../app/tables/[tableId]/page.tsx', '../app/table/[tableId]/page.tsx'];

for (const path of sites) {
  test(path + " : le bouton \"Sélectionner\"/\"Annuler\" est un bouton texte de TopBar, jamais un lien souligné", () => {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /underline underline-offset-2/, path + ' ne doit plus avoir de lien souligné');
    assert.doesNotMatch(source, /Sélectionner plusieurs invités/, path + ' garde l\'ancien libellé long');
    assert.doesNotMatch(source, /Annuler la sélection/, path + ' garde l\'ancien libellé long');
    // Rendu via TopBar right, pas un <button> flottant dans le corps de page.
    const topBarBlock = source.slice(source.indexOf('<TopBar'), source.indexOf('<TopBar') + 1100);
    assert.match(topBarBlock, /right=\{/, path + ' doit passer le bouton via right={...} de TopBar');
    assert.match(topBarBlock, /canMoveGuests && !echangeAvecTableId \?/);
    assert.match(topBarBlock, /\{selectMode \? 'Annuler' : 'Sélectionner'\}/);
    assert.match(topBarBlock, /className="whitespace-nowrap text-sm font-semibold text-accent active:opacity-60"/);
  });
}
