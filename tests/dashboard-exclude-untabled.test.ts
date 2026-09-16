import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Retour de Gersom le 16/09/2026 (capture d'écran du tableau de bord) :
// "les invités qui n'ont pas de table, enlève-les du calcul. Exemple,
// Auguste. On veut seulement voir le nombre d'invités." Une invitation
// sans table_id (ex. les 19 ajoutées sans table en v1.47.0) n'a pas encore
// de place dans la salle -- le tableau de bord suit le remplissage de la
// salle, donc toute la carte "Invités attendus"/"Arrivés"/"Restants"/"Taux
// d'arrivée" + les quatre mini-tuiles (Complètes/Partielles/Non
// arrivées/Supplémentaires) doit exclure ces invitations, et le détail
// (/dashboard/liste) doit rester cohérent avec les tuiles qui y mènent.

const dashboardSource = readFileSync(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
const listeSource = readFileSync(new URL('../app/dashboard/liste/page.tsx', import.meta.url), 'utf8');

test('le tableau de bord exclut les invitations sans table (table_id null) du calcul attendus/arrivés/restants/taux', () => {
  assert.match(
    dashboardSource,
    /const invitationsAvecTable = useMemo\(\(\) => invitations\.filter\(\(i\) => i\.table_id !== null\), \[invitations\]\);/
  );
  const statsBlock = dashboardSource.slice(dashboardSource.indexOf('const stats = useMemo'), dashboardSource.indexOf('}, [invitationsAvecTable]);'));
  assert.match(statsBlock, /invitationsAvecTable\.reduce\(\(s, i\) => s \+ i\.nombre_prevu, 0\)/);
  assert.match(statsBlock, /invitationsAvecTable\.reduce\(\(s, i\) => s \+ i\.nombre_arrive, 0\)/);
  assert.match(statsBlock, /invitationsAvecTable\.filter\(\(i\) => i\.statut === 'complet'\)\.length/);
  assert.match(statsBlock, /invitationsAvecTable\.filter\(\(i\) => i\.statut === 'partiel'\)\.length/);
  assert.match(statsBlock, /invitationsAvecTable\.filter\(\(i\) => i\.statut === 'non_arrive'\)\.length/);
  assert.match(statsBlock, /invitationsAvecTable\.reduce\(\(s, i\) => s \+ Math\.max\(0, i\.nombre_arrive - i\.nombre_prevu\), 0\)/);
});

test("/dashboard/liste (le détail derrière chaque tuile) exclut aussi les invitations sans table par défaut, pour rester cohérent avec le chiffre affiché sur la tuile", () => {
  const filtresBlock = listeSource.slice(listeSource.indexOf('const filtres = invitations.filter'), listeSource.indexOf('const totalPersonnes'));
  assert.match(filtresBlock, /if \(inv\.table_id === null\) return false;/);
});

// v1.53.14, retour de Gersom (capture d'écran de "Tous les invités") : "il
// faudra avoir un petit bouton pour dire... sans table, tout simplement...
// pour ceux qui sont sans table" -- depuis que ces invitations sont
// exclues par défaut, il faut un moyen de les retrouver pour leur assigner
// une table.
test("une pastille dédiée \"Sans table\" isole exactement les invitations sans table (l'inverse de l'exclusion par défaut)", () => {
  assert.match(listeSource, /type ListeFiltre = 'toutes' \| 'Nelly' \| 'Gege' \| 'staff' \| 'sansTable';/);
  assert.match(listeSource, /\{ key: 'sansTable', label: 'Sans table', valeur: 'sansTable' as ListeFiltre \}/);
  const filtresBlock = listeSource.slice(listeSource.indexOf('const filtres = invitations.filter'), listeSource.indexOf('const totalPersonnes'));
  assert.match(filtresBlock, /if \(listeFiltre === 'sansTable'\) return inv\.table_id === null;/);
});
