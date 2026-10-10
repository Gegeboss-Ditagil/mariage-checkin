// Données de test SYNTHÉTIQUES (aucune donnée réelle) pour la pile locale de
// tests fonctionnels -- voir scripts/qa-stack/README.md. Écrit du SQL sur la
// sortie standard. Un compte par rôle, PIN connus (pile locale uniquement).
import { hashSecret } from '../../lib/auth.ts';

export const QA_EVENT_ID = '00000000-0000-4000-8000-000000000001';
export const QA_USERS = [
  { name: 'QA Admin', role: 'admin', pin: '1111' },
  { name: 'QA Directeur', role: 'directeur', pin: '2222' },
  { name: 'QA Placeur', role: 'placeur', pin: '3333' },
  { name: 'QA Scanneur', role: 'agent_checkin', pin: '4444' },
  { name: 'QA Approbateur', role: 'visibilite', pin: '5555' },
] as const;

const q = (v: string | null) => (v === null ? 'null' : "'" + v.replace(/'/g, "''") + "'");
const out: string[] = [];
out.push('begin;');
for (const u of QA_USERS) {
  out.push(
    `insert into users (event_id, nom_affichage, nom_complet, role, pin_hash, active, is_super_admin) values ('${QA_EVENT_ID}', ${q(u.name)}, ${q(u.name)}, ${q(u.role)}, ${q(hashSecret(u.pin))}, true, ${u.role === 'admin'});`
  );
}
// Invitations : sur chaque table normale (2-41), 3 groupes (1, 2 et 4
// personnes, « Membres: » renseignés) -> 7/10. Aucune ligne nominative :
// toutes « jamais ouvertes », comme 251 invitations réelles le jour J.
const prenoms = ['Ana', 'Bruno', 'Chloé', 'David', 'Élise', 'Fabrice', 'Grâce', 'Hugo'];
let k = 0;
for (let table = 2; table <= 41; table += 1) {
  for (const size of [1, 2, 4]) {
    k += 1;
    const famille = 'Test' + String(k).padStart(3, '0');
    const membres = Array.from({ length: size }, (_, i) => prenoms[(k + i) % prenoms.length] + ' ' + famille);
    const nom = size === 1 ? membres[0] : 'Famille ' + famille;
    const cote = k % 2 === 0 ? 'Gege' : 'Nelly';
    out.push(
      `insert into invitations (event_id, table_id, nom_affichage, nombre_prevu, nombre_arrive, statut, cote, notes, telephone, placement_status) select '${QA_EVENT_ID}', id, ${q(nom)}, ${size}, 0, 'non_arrive', '${cote}', ${q('RSVP: Oui, embarquement confirmé | Membres: ' + membres.join(', '))}, ${q('+4179000' + String(k).padStart(4, '0'))}, 'confirmee' from tables where event_id = '${QA_EVENT_ID}' and number = ${table};`
    );
  }
}
// Une invitation sans table et une marquée « ne viendra pas ».
out.push(`insert into invitations (event_id, nom_affichage, nombre_prevu, statut, cote, notes) values ('${QA_EVENT_ID}', 'Famille SansTable', 2, 'non_arrive', 'Gege', 'Membres: Iris SansTable, Jules SansTable');`);
out.push(`update invitations set ne_viendra_pas = true where nom_affichage = 'Famille Test003';`);
// Agenda.
out.push(`insert into agenda_items (event_id, time_label, title, sort_order) values ('${QA_EVENT_ID}', '17:00', 'Accueil des invités', 1), ('${QA_EVENT_ID}', '19:00', 'Entrée des mariés', 2), ('${QA_EVENT_ID}', '21:00', 'Ouverture du bal', 3);`);
// Une demande d'invité surprise en attente (photo factice).
out.push(
  `insert into guest_approval_requests (event_id, token, cote, nom_invite, nombre_invites, photo_url, approver_phone) values ('${QA_EVENT_ID}', 'qa-token-1', 'Gege', 'QA Surprise', 1, 'qa/photo.jpg', '+41790000000');`
);
out.push('commit;');
console.log(out.join('\n'));
