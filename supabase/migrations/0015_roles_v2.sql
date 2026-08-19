-- Historique uniquement : cette migration est deja appliquee en production.
alter table users drop constraint users_role_check;
alter table users add constraint users_role_check
  check (role in ('admin', 'directeur', 'placeur', 'agent_checkin', 'visibilite'));

update users set role = 'placeur' where nom_affichage = 'Nelly Lukau';
update users set role = 'directeur' where nom_affichage in ('Remi Landu', 'Sem Landu', 'Tuzola');

