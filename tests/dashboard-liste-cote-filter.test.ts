import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// app/dashboard/liste/page.tsx melange JSX et TS : meme convention que les
// autres tests de ce dossier (voir floor-plan.test.ts) -- inspection du
// code source plutot qu'import direct dans node:test.
const source = readFileSync(new URL('../app/dashboard/liste/page.tsx', import.meta.url), 'utf8');

test('les listes du dashboard (restants/arrives/tous/...) ont un filtre par cote, meme design que /plan-table', () => {
  // Demande de Gersom le 28/08/2026, sur les memes tuiles personnes/côté
  // Nelly/côté Gégé que /plan-table : taper "côté Nelly"/"côté Gégé" doit
  // filtrer la liste juste en dessous. Meme lecon retenue que v1.19.1 : une
  // pastille dediee avec etat actif net (fond plein), pas une tuile
  // cliquable dont l'etat actif se voit mal.
  assert.match(source, /const \[listeFiltre, setListeFiltre\] = useState<ListeFiltre>\('toutes'\);/);
  assert.match(source, /inv\.cote === listeFiltre/);
  assert.match(source, /border-accent bg-accent text-on-accent/);
});

test('un filtre "Staff" isole category === Staff, car le total "personnes" melange invites et staff', () => {
  // Demande de Gersom le 28/08/2026 : le total "399 personnes" (tuile du
  // haut) inclut le staff sans distinction possible -- ajout d'une
  // quatrieme pastille "Staff" dans la meme rangee, single-select avec
  // "Toutes"/"Côté Nelly"/"Côté Gégé".
  assert.match(source, /type ListeFiltre = 'toutes' \| 'Nelly' \| 'Gege' \| 'staff';/);
  assert.match(source, /listeFiltre === 'staff' \? inv\.category === 'Staff' : inv\.cote === listeFiltre/);
  assert.match(source, /\{ key: 'staff', label: 'Staff', valeur: 'staff' as ListeFiltre \}/);
});

test('changer de liste (type) reinitialise le filtre actif', () => {
  // Un filtre laisse actif d'une liste a l'autre (ex. en passant de
  // "Invités restants" a "Invités arrivés") serait une source de confusion
  // silencieuse -- la liste semblerait incomplete sans raison visible.
  assert.match(source, /useEffect\(\(\) => \{\r?\n\s*setListeFiltre\('toutes'\);\r?\n\s*\}, \[type\]\);/);
});

test('les tuiles de stats refletent le filtre actif, et la rangee de filtre reste visible meme sans resultat pour permettre de revenir a Toutes', () => {
  // La rangee de filtre n'est gardee que par `!loading`, jamais aussi par
  // `filtres.length > 0` -- sinon un filtre sans resultat masquerait le
  // seul moyen de revenir a "Toutes".
  assert.match(source, /\{!loading && \(\s*<div className="mb-4 flex flex-wrap gap-2">/);
  assert.match(source, /const totalParCote = filtres\.reduce/);
});
