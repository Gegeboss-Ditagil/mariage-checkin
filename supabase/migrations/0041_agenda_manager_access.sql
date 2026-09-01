-- v1.31.0 - Exception nominative pour les gestionnaires d'agenda qui ne
-- portent pas le role directeur (Nelly est placeur dans la matrice globale).
alter table users add column if not exists agenda_manager boolean not null default false;

update users
set agenda_manager = true
where nom_affichage = 'Nelly Lukau'
   or nom_complet = 'Nelly Dos Goncalves';

