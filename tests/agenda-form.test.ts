import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const agendaPage = readFileSync(new URL('../app/agenda/page.tsx', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const agendaApiSource = readFileSync(new URL('../app/api/agenda/route.ts', import.meta.url), 'utf8');
const agendaCustomAssigneesMigration = readFileSync(
  new URL('../supabase/migrations/0043_agenda_custom_assignees.sql', import.meta.url),
  'utf8'
);
const responsablePickerSource = readFileSync(new URL('../components/ResponsablePicker.tsx', import.meta.url), 'utf8');

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
  assert.match(agendaPage, /<ModalHeader title="Modifier l’activité" onClose=\{\(\) => openEditing\(null\)\} \/>/);
});

test('le selecteur de responsables utilise une coche personnalisee (rond accent) au lieu de la case a cocher par defaut du navigateur', () => {
  // Deplace le 02/09/2026 dans components/ResponsablePicker.tsx (retour de
  // Gersom : "au lieu d'avoir toute la liste des responsables a defiler...
  // un champ") -- chaque ligne est desormais un <button> entier (coche
  // visuelle + nom), plus une case a cocher HTML cachee derriere un <label>.
  assert.match(responsablePickerSource, /rounded-full border-2 border-accent/);
  assert.doesNotMatch(responsablePickerSource, /type="checkbox"/);
});

// Corrige le 02/09/2026 (retour de Gersom sur la capture de la liste) :
// seul le bloc de texte (titre/departement/details/responsables) ouvrait la
// modification -- taper l'heure ou l'espace vide de la carte ne faisait
// rien. La case a cocher "termine" (qui doit continuer a fonctionner sans
// ouvrir la modification) etait le seul autre element interactif.
test('toute la carte d\'une activite ouvre la modification (pas seulement le bloc de texte), la case terminee reste independante, et le lien jaune redondant a disparu', () => {
  assert.match(agendaPage, /role=\{canManage \? 'button' : undefined\}/);
  assert.match(agendaPage, /onClick=\{\(\) => canManage && openEditing\(item\)\}/);
  // La carte entiere porte le onClick -- l'ancien <button> qui n'enveloppait
  // que le texte est redevenu un simple <div>.
  assert.doesNotMatch(agendaPage, /<button type="button" onClick=\{\(\) => canManage && (setEditing|openEditing)\(item\)\}/);
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
test("la ligne responsables d'une carte ne s'affiche que si quelqu'un est assigne (jamais un placeholder), et combine comptes + noms libres", () => {
  assert.doesNotMatch(agendaPage, /Responsable à attribuer/);
  assert.match(agendaPage, /\{assigneeNames\.length > 0 && <p className="mt-2 text-xs font-semibold text-text-muted">/);
  // Noms libres (ex: prestataires sans compte) affiches avec les comptes
  // assignes -- demande de Gersom le 02/09/2026.
  assert.match(agendaPage, /custom_assignees: string\[\]/);
  // Filet cote client (`|| []`) : voir le test de normalisation cote API
  // plus bas -- si la migration 0043 n'est pas encore appliquee en prod,
  // ce champ manque sur les items deja en memoire et un spread sur
  // `undefined` plantait toute la page (retour de Gersom, 02/09/2026).
  assert.match(agendaPage, /\.\.\.\(item\.custom_assignees \|\| \[\]\)/);
});

// Demande de Gersom le 02/09/2026 : "permet aussi d'ajouter un nom
// personnalisé... si c'est une tâche personnelle ou une tâche en
// particulier" (ex: "Nourdine, électricien") -- un responsable sans compte
// dans l'application, en plus des comptes existants.
test('la fiche de modification permet d\'ajouter un responsable au nom libre, sans compte', () => {
  assert.match(agendaCustomAssigneesMigration, /alter table agenda_items add column if not exists custom_assignees text\[\] not null default '\{\}'/);
  assert.match(agendaApiSource, /function sanitizeCustomAssignees/);
  assert.match(agendaApiSource, /custom_assignees: sanitizeCustomAssignees\(body\.custom_assignees\)/);
  assert.match(agendaApiSource, /if \('custom_assignees' in updates\) updates\.custom_assignees = sanitizeCustomAssignees/);
  // Deplace le 02/09/2026 dans components/ResponsablePicker.tsx (voir le
  // test dedie plus bas) ; la page elle-meme ne fait plus que transmettre
  // custom_assignees au picker et le reflete dans le resume du champ.
  // La page transmet custom_assignees en gardant la distinction fiche en
  // cours d'edition / nouvelle activite -- le ternaire reflete le meme flux.
  assert.match(agendaPage, /selectedCustomNames=\{editing \? editing\.custom_assignees \|\| \[\] : newCustomAssignees\}/);
  assert.match(responsablePickerSource, /placeholder="Ex\. Nourdine, électricien"/);
});

test("la creation d'une activite permet de choisir les responsables avant le partage", () => {
  assert.match(agendaPage, /newAssigneeIds/);
  assert.match(agendaPage, /newCustomAssignees/);
  assert.match(agendaPage, /assignee_ids: newAssigneeIds, custom_assignees: newCustomAssignees/);
  assert.match(agendaPage, /<FieldLabel>Responsables<\/FieldLabel>/);
  assert.match(agendaPage, /return names\.length > 0 \? names\.join\(', '\) : 'Choisir les responsables'/);
  assert.match(agendaPage, /selectedPersonIds=\{editing \? editing\.assignee_ids : newAssigneeIds\}/);
});

test("le picker de responsables recherche aussi parmi les invites (aide de derniere minute), en plus de l'equipe et du nom libre", () => {
  // Demande de Gersom le 02/09/2026 : "ça va me montrer toutes les
  // personnes qui ont l'étiquette staff... mais aussi l'option de
  // recherche au cas où on assigne un invité lambda dernière minute pour
  // aider". L'equipe (people) est affichee par defaut ; les invites ne se
  // chargent qu'a partir de 2 caracteres, jamais toute la liste d'un coup.
  assert.match(responsablePickerSource, /from\('invitations'\)/);
  assert.match(responsablePickerSource, /\.ilike\('nom_affichage', '%' \+ q \+ '%'\)/);
  assert.match(responsablePickerSource, /if \(q\.length < 2\) \{/);
  assert.match(responsablePickerSource, /toggleCustomName\(guest\.nom_affichage\)/);
});

test("l'API /api/agenda normalise custom_assignees en tableau meme si la migration 0043 n'est pas encore appliquee (select('*') omet silencieusement une colonne manquante)", () => {
  assert.match(agendaApiSource, /function normalizeAgendaItem/);
  assert.match(agendaApiSource, /items: \(items \|\| \[\]\)\.map\(normalizeAgendaItem\)/);
  assert.match(agendaApiSource, /item: normalizeAgendaItem\(data\)/);
});
