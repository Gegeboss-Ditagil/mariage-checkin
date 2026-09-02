import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Retour de Gersom le 02/09/2026 (capture d'écran de /admin/users à
// l'appui) : "pour activer et désactiver, ça puisse être un toggle avec le
// theme ios verre liquide" et "donne moi aussi la possibilité de changer de
// rôle / accès la personne".

const pageSource = readFileSync(new URL('../app/admin/users/page.tsx', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../app/api/admin/users/route.ts', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('Actif/Désactivé est une vraie bascule en verre liquide (glass-toggle), plus un badge texte cliquable', () => {
  assert.match(pageSource, /role="switch"/);
  assert.match(pageSource, /aria-checked=\{u\.active\}/);
  assert.match(pageSource, /className=\{'glass-toggle' \+ \(u\.active \? ' glass-toggle-on' : ''\)\}/);
  assert.doesNotMatch(pageSource, /bg-status-complete\/10 text-status-complete/);
  assert.match(cssSource, /\.glass-toggle \{/);
  assert.match(cssSource, /\.glass-toggle-on \{/);
  assert.match(cssSource, /\.glass-toggle-thumb \{/);
  assert.match(cssSource, /-webkit-backdrop-filter: blur\(10px\) saturate\(160%\);/);
});

test("la fiche d'édition permet de changer le rôle/accès d'un compte, avec la même liste que la création", () => {
  assert.match(pageSource, /const ROLE_OPTIONS: \{ value: Role; label: string \}\[\] = \[/);
  assert.match(pageSource, /const \[editRole, setEditRole\] = useState<Role>\('agent_checkin'\)/);
  assert.match(pageSource, /setEditRole\(u\.role\)/); // startEdit initialise depuis le rôle actuel
  assert.match(pageSource, /value=\{editRole\}/);
  assert.match(pageSource, /onChange=\{\(e\) => setEditRole\(e\.target\.value as Role\)\}/);
  // Les champs affichés (email/mot de passe vs PIN) suivent le rôle EN
  // COURS DE SELECTION (editRole), pas l'ancien rôle -- sinon choisir
  // "Admin" dans la liste ne ferait rien apparaître de nouveau à l'écran.
  assert.match(pageSource, /editRole === 'admin' \? \(/);
});

test("changer de rôle n'envoie le champ role que s'il a réellement changé, jamais a chaque édition banale", () => {
  assert.match(pageSource, /const roleChanged = editRole !== u\.role;/);
  assert.match(pageSource, /if \(roleChanged\) body\.role = editRole;/);
});

test('/api/admin/users PATCH exige les nouveaux identifiants quand le rôle change (le mode de connexion en dépend), et efface le mode devenu obsolète', () => {
  assert.match(routeSource, /const ROLES = \['admin', 'directeur', 'placeur', 'agent_checkin', 'visibilite'\];/);
  assert.match(routeSource, /if \(role !== undefined && !ROLES\.includes\(role\)\)/);
  assert.match(routeSource, /if \(role === 'admin'\) \{/);
  assert.match(routeSource, /if \(!email \|\| !password\) \{/);
  assert.match(routeSource, /updates\.pin_hash = null;/);
  assert.match(routeSource, /\} else if \(typeof role === 'string'\) \{/);
  assert.match(routeSource, /if \(!pin\) \{/);
  assert.match(routeSource, /updates\.email = null;/);
  assert.match(routeSource, /updates\.password_hash = null;/);
});
