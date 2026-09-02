-- ============================================================================
-- Permet d'assigner une activite de l'agenda a un nom libre (ex: "Nourdine,
-- electricien"), pas seulement a un compte existant de l'application --
-- demande de Gersom le 02/09/2026 : le directeur de festin doit pouvoir
-- noter un prestataire ou une tache ponctuelle sans avoir a lui creer un
-- compte. `assignee_ids` (uuid[], voir 0039_shared_agenda.sql) reste reserve
-- aux vrais comptes actifs -- une nouvelle colonne texte separee accueille
-- les noms libres, affiches a cote des responsables assignes.
-- ============================================================================

alter table agenda_items add column if not exists custom_assignees text[] not null default '{}';
