import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// v1.67.1, retour de Gersom (suite directe du correctif de blocage de
// v1.66.2, hooks/useDismiss.ts) : "on va mettre deux modes, le mode View et
// le mode Edit... un petit bouton Edit en haut... comme ça, quand on est sur
// View, la seule chose qu'on peut faire, c'est scroll down. Quand on
// appuie, ça fera rien. Ça va éviter le problème." Durcit l'app contre une
// classe entière de bugs de fiches modales accidentellement ouvertes par un
// tap rapide en faisant défiler, EN PLUS du vrai correctif de v1.66.2 -- ne
// le remplace pas.

const agendaPage = readFileSync(new URL('../app/agenda/page.tsx', import.meta.url), 'utf8');

test("editMode existe, toujours désactivé par défaut (View) à l'ouverture de la page", () => {
  assert.match(agendaPage, /const \[editMode, setEditMode\] = useState\(false\);/);
});

test('canEditNow = canManage && editMode -- un rôle sans canManage ne peut jamais entrer en édition, peu importe editMode', () => {
  assert.match(agendaPage, /const canEditNow = canManage && editMode;/);
});

test('le bouton Modifier/Terminé (TopBar, slot "right") reste visible dès que canManage est vrai -- jamais lui-même gated par editMode (sinon impossible de repasser en Modifier)', () => {
  const topBarBlock = agendaPage.slice(agendaPage.indexOf('<TopBar'), agendaPage.indexOf('<div className="flex-1 overflow-y-auto'));
  assert.match(topBarBlock, /canManage && \(/);
  assert.doesNotMatch(topBarBlock, /canEditNow/);
  assert.match(topBarBlock, /onClick=\{\(\) => setEditMode\(\(v\) => !v\)\}/);
  assert.match(topBarBlock, /aria-label=\{editMode \? 'Terminer la modification' : 'Modifier le chronogramme'\}/);
});

// v1.67.2, retour de Gersom : "assure-toi que le bouton Edit soit une
// espèce de belle icône qui comprend qu'est-ce qu'il faut modifier" -- une
// vraie icone SVG (meme convention duotone que le reste de l'app, voir
// components/icons.tsx), jamais seulement le texte "Modifier" ni le glyphe
// "✎" deja utilise ailleurs (TopBar.tsx, onTitleClick).
//
// v1.69.2, retour de Gersom : "met une plus belle icône pour modifier au
// lieu de juste du texte... icône qui suit le thème liquid glass" -- le
// libellé texte "Modifier"/"Terminé" disparaît du bouton (reste en
// aria-label, voir test ci-dessus), remplacé par .glass-icon-button (même
// bouton rond en verre que TopBar/AddInvitationButton) avec une icône qui
// bascule EditIcon/CheckIcon selon l'état.
test("le bouton d'entrée en mode édition est un bouton rond .glass-icon-button, icône seule (EditIcon/CheckIcon selon l'état), jamais du texte visible", () => {
  assert.match(agendaPage, /import \{ CloseIcon, ChevronRightIcon, EditIcon, CheckIcon \} from '@\/components\/icons';/);
  const topBarBlock = agendaPage.slice(agendaPage.indexOf('<TopBar'), agendaPage.indexOf('<div className="flex-1 overflow-y-auto'));
  assert.match(topBarBlock, /className="glass-icon-button"/);
  assert.match(topBarBlock, /\{editMode \? <CheckIcon className="h-5 w-5" \/> : <EditIcon className="h-5 w-5" \/>\}/);
  assert.doesNotMatch(topBarBlock, />\s*Modifier\s*</);
  assert.doesNotMatch(topBarBlock, />\s*Terminé\s*</);

  const iconSource = readFileSync(new URL('../components/icons.tsx', import.meta.url), 'utf8');
  assert.match(iconSource, /export function EditIcon\(\{ className \}: IconProps\)/);
  assert.match(iconSource, /export function CheckIcon\(\{ className \}: IconProps\)/);
});

// "La seule chose qu'on peut faire [en View], c'est scroll down. Quand on
// appuie, ça fera rien." -- chaque élément qui ouvre/modifie une fiche doit
// être gated sur canEditNow, jamais canManage seul (qui ne dépend plus du
// mode actif).
test('tous les déclencheurs d\'édition (carte, case "terminé", + Ajouter ici/à la fin) sont gated sur canEditNow, jamais canManage seul', () => {
  assert.match(agendaPage, /\{canEditNow && <button type="button".*\+ Ajouter une activité ici<\/button>\}/);
  assert.match(agendaPage, /\{canEditNow && <li><button type="button".*\+ Ajouter une activité à la fin<\/button><\/li>\}/);
  assert.match(agendaPage, /canEditNow && 'cursor-pointer transition-transform active:scale-\[0\.99\]'/);
  assert.match(agendaPage, /onClick=\{\(\) => canEditNow && openEditing\(item\)\}/);
  assert.match(agendaPage, /role=\{canEditNow \? 'button' : undefined\}/);
  assert.match(agendaPage, /tabIndex=\{canEditNow \? 0 : undefined\}/);
  assert.match(agendaPage, /aria-label=\{canEditNow \? 'Modifier ' \+ item\.title : undefined\}/);
  assert.match(agendaPage, /onKeyDown=\{canEditNow \? \(e\) => \{ if \(e\.key === 'Enter' \|\| e\.key === ' '\) \{ e\.preventDefault\(\); openEditing\(item\); \} \} : undefined\}/);
  // La case "terminé" elle-même : "appuyer, ça fera rien" en View aussi.
  assert.match(agendaPage, /\{canEditNow && \(\s*\n\s*<button\s*\n\s*type="button"\s*\n\s*aria-label=\{item\.completed/);
});

test("fermer une fiche déjà ouverte (openEditing(null), le callback de useDismiss) reste toujours possible, jamais gated par editMode -- seule l'OUVERTURE d'une nouvelle fiche l'est", () => {
  assert.match(agendaPage, /useDismiss\(\(\) => openEditing\(null\)\)/);
  assert.match(agendaPage, /useDismiss\(\(\) => setInsertAt\(null\)\)/);
});
