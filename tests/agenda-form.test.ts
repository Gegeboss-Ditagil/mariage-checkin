import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const agendaPage = readFileSync(new URL('../app/agenda/page.tsx', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

// Corrige le 02/09/2026 (retour de Gersom sur le design du formulaire) :
// `className="input"` etait utilise sur /agenda depuis la creation du
// chronogramme partage (v1.30.0) mais la classe n'a jamais ete definie --
// meme bug que .eyebrow avant lui (voir globals.css) : les champs
// retombaient sur le style par defaut du navigateur (bordure fine noire,
// libelle colle au champ, aucun espacement).
test("la classe .input existe reellement (n'est plus orpheline) et suit l'habillage du reste de l'application", () => {
  assert.match(globalStyles, /\.input\s*\{/);
  assert.match(globalStyles, /rounded-xl2 border-2 border-hairline bg-surface/);
  assert.match(globalStyles, /focus:border-accent focus:outline-none/);
});

test("les libelles des champs d'agenda sont des <label> separes, jamais accoles au texte du champ", () => {
  // L'ancien code ecrivait `<label ...>Heure<input .../></label>` -- le nom
  // du champ et sa valeur s'affichaient donc colles ("Heure08:00", capture
  // d'ecran de Gersom). Le nouveau motif isole le libelle dans son propre
  // element avant le champ.
  assert.doesNotMatch(agendaPage, />Heure<input/);
  assert.doesNotMatch(agendaPage, />Activité<input/);
  assert.doesNotMatch(agendaPage, />Département<input/);
  assert.match(agendaPage, /function FieldLabel/);
  assert.match(agendaPage, /<FieldLabel>Heure<\/FieldLabel>/);
  assert.match(agendaPage, /<FieldLabel>Activité<\/FieldLabel>/);
  assert.match(agendaPage, /<FieldLabel>Département<\/FieldLabel>/);
  assert.match(agendaPage, /<FieldLabel>Détails et consignes<\/FieldLabel>/);
});

test("le champ Heure utilise la roue native iOS/Android (type=\"time\") au lieu d'un texte libre, avec plage optionnelle", () => {
  // Demande explicite de Gersom : "Heure met le roll comme iPhone pour choisir".
  assert.match(agendaPage, /function TimeRangePicker/);
  assert.match(agendaPage, /type="time"/);
  assert.match(agendaPage, /input type="hidden" name="time_label"/);
  assert.match(agendaPage, /Ajouter une heure de fin \(plage horaire\)/);
  // La composition/analyse gere aussi bien "08:00" que "18:30–19:00" (voir
  // le seed 0039_shared_agenda.sql) -- ne doit jamais casser les plages
  // existantes.
  assert.match(agendaPage, /function parseTimeLabel/);
  assert.match(agendaPage, /function composeTimeLabel/);
  assert.match(agendaPage, /<TimeRangePicker key=\{editing\.id\} initialLabel=\{editing\.time_label\}/);
});

test('les deux formulaires (nouvelle activite, modifier) ont un bouton de fermeture rond en verre, comme /approbations', () => {
  assert.match(agendaPage, /function ModalHeader/);
  assert.match(agendaPage, /CloseIcon/);
  assert.match(agendaPage, /rounded-full border border-white\/30 bg-surface\/75.*backdrop-blur-xl/);
  assert.match(agendaPage, /<ModalHeader title="Nouvelle activité" onClose=\{\(\) => setInsertAt\(null\)\} \/>/);
  assert.match(agendaPage, /<ModalHeader title="Modifier l’activité" onClose=\{\(\) => setEditing\(null\)\} \/>/);
});

test('la liste des responsables utilise une coche personnalisee (rond accent) au lieu de la case a cocher par defaut du navigateur', () => {
  assert.match(agendaPage, /className="sr-only"/);
  assert.match(agendaPage, /rounded-full border-2 border-accent/);
});

// Corrige le 02/09/2026 (retour de Gersom sur la capture de la liste) :
// seul le bloc de texte (titre/departement/details/responsables) ouvrait la
// modification -- taper l'heure ou l'espace vide de la carte ne faisait
// rien. La case a cocher "termine" (qui doit continuer a fonctionner sans
// ouvrir la modification) etait le seul autre element interactif.
test('toute la carte d\'une activite ouvre la modification (pas seulement le bloc de texte), la case terminee reste independante, et le lien jaune redondant a disparu', () => {
  assert.match(agendaPage, /role=\{canManage \? 'button' : undefined\}/);
  assert.match(agendaPage, /onClick=\{\(\) => canManage && setEditing\(item\)\}/);
  // La carte entiere porte le onClick -- l'ancien <button> qui n'enveloppait
  // que le texte est redevenu un simple <div>.
  assert.doesNotMatch(agendaPage, /<button type="button" onClick=\{\(\) => canManage && setEditing\(item\)\}/);
  // La case cochee stoppe la propagation pour ne pas aussi ouvrir la carte.
  assert.match(agendaPage, /onClick=\{\(e\) => \{ e\.stopPropagation\(\); void patchItem\(item\.id, \{ completed: !item\.completed \}\); \}\}/);
  // Le lien texte en accent devenu redondant (la carte entiere s'ouvre déjà)
  // a disparu ; la couleur d'alerte du champ "Responsable a attribuer" est
  // neutralisee, plus besoin de la mettre en jaune.
  assert.doesNotMatch(agendaPage, /Modifier l.heure, les détails ou les responsables/);
  assert.doesNotMatch(agendaPage, /text-status-partial/);
});

// Corrige le 02/09/2026 (retour de Gersom) : "Ni le texte orange, on
// affiche responsable seulement si il y en a un dans la carte" -- le
// placeholder "Responsable à attribuer" (texte + couleur) est retire de la
// liste ; la ligne responsables ne s'affiche plus du tout tant que
// personne n'est assigne, au lieu de rester visible comme texte d'invite.
test("la ligne responsables d'une carte ne s'affiche que si quelqu'un est assigne (jamais un placeholder)", () => {
  assert.doesNotMatch(agendaPage, /Responsable à attribuer/);
  assert.match(agendaPage, /\{assignees\.length > 0 && <p className="mt-2 text-xs font-semibold text-text-muted">/);
});
