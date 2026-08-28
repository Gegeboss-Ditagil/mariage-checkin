import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// LiberationPlacesPanel.tsx et le checkin melangent JSX et TS : meme
// convention que les autres tests de ce dossier (voir floor-plan.test.ts) --
// inspection du code source plutot qu'import direct dans node:test.
const panelSource = readFileSync(new URL('../components/LiberationPlacesPanel.tsx', import.meta.url), 'utf8');
const checkinSource = readFileSync(new URL('../app/checkin/[invitationId]/page.tsx', import.meta.url), 'utf8');
// Les fichiers du checkout Windows utilisent CRLF. Normaliser ici garde les
// assertions structurelles identiques sur Windows, Linux et macOS.
const normalizedPanelSource = panelSource.replaceAll('\r\n', '\n');

test('liberer une place propose desormais un "Annuler" qui remet la personne via /api/members/add', () => {
  // Trouve par Gersom le 28/08/2026 : une fois une place liberee (donc le
  // membre supprime en base par remove_invitation_member), il n'y avait
  // aucun moyen rapide de revenir en arriere -- seulement repasser par
  // "Gerer les membres du groupe" et retaper le nom a la main.
  assert.match(panelSource, /lastReleased/);
  assert.match(panelSource, /handleUndo/);
  assert.match(panelSource, /fetch\('\/api\/members\/add'/);
  assert.match(panelSource, /↩️ Annuler/);
});

test('le nom et prenom exacts sont captures AVANT la suppression, jamais redecoupes depuis le label affiche', () => {
  // Redecouper "Jean-Paul Van Der Berg" en (prenom, nom) depuis une chaine
  // affichee perdrait de l'information -- capturer prenom/nom depuis la
  // source (GuestRow ou DraftMember) avant l'appel a /api/members/remove
  // est le seul moyen fiable de les remettre a l'identique.
  assert.match(panelSource, /released: ReleasedMember\[\] = members/);
  assert.match(panelSource, /prenom: m\.prenom, nom: m\.nom/);
});

test('lastReleased n est jamais efface par un rechargement temps reel, seulement en changeant de groupe', () => {
  // Le rechargement temps reel (load()) est declenche par notre propre
  // suppression -- si lastReleased etait remis a null a l'interieur de
  // load(), le bouton "Annuler" disparaitrait avant meme d'avoir pu
  // s'afficher. Seul un changement d'invitation.id doit le reinitialiser.
  const loadFn = normalizedPanelSource.slice(
    normalizedPanelSource.indexOf('async function load()'),
    normalizedPanelSource.indexOf('useEffect(() => {\n    load();')
  );
  assert.doesNotMatch(loadFn, /setLastReleased/);
  assert.match(normalizedPanelSource, /useEffect\(\(\) => \{\n    setLastReleased\(null\);/);
});

test('"Cet invité ne viendra pas" se cache quand LiberationPlacesPanel prend deja le relais, mais reste joignable pour annuler', () => {
  // Redondant pour un groupe dont le detail des membres est connu (le
  // panneau par-membre suffit) -- mais doit rester visible pour une
  // invitation solo (le panneau ne s'affiche jamais dans ce cas) et pour
  // annuler un marquage deja pose, quel que soit l'etat du panneau.
  assert.match(checkinSource, /onVisibilityChange=\{setPanelVisible\}/);
  assert.match(checkinSource, /invitation\.nombre_arrive === 0 && \(invitation\.ne_viendra_pas \|\| !panelVisible\) && \(/);
  // Part de false (pas cache) par defaut : jamais de flash-disparition du
  // bouton au premier affichage avant que le panneau ne confirme visible.
  assert.match(checkinSource, /const \[panelVisible, setPanelVisible\] = useState\(false\);/);
});
