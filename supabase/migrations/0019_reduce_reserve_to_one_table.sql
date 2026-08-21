-- ============================================================================
-- Reduit le nombre de tables de reserve de 3 (38-40) a 1 seule (41), et fait
-- passer les anciennes tables de reserve 38-40 en tables normales.
--
-- Nouvelle structure : 41 tables au total = 40 tables normales (1-40) +
-- 1 seule table de reserve (41). Capacite officielle : 40 x 10 = 400 places
-- (au lieu de 37 x 10 = 370 auparavant). Capacite maximale absolue avec la
-- reserve : 41 x 10 = 410, mais l'objectif reste 400 personnes.
--
-- Demande explicite de Gersom le 21/08/2026. Deja applique manuellement en
-- production (aucun overflow_assignment existant au moment du changement,
-- donc rien a migrer sur ce cote) -- cette migration documente le
-- changement dans le schema versionne sur GitHub, comme l'exige
-- docs/DATA_CHANGE_INSTRUCTIONS.md (section 10, ne jamais modifier la
-- production sans reporter le changement dans les migrations GitHub).
--
-- Idempotente : peut etre rejouee sans effet si deja appliquee.
-- ============================================================================

-- 1) Les anciennes tables de reserve 38, 39, 40 deviennent des tables
--    normales (leurs invitations existantes ne sont pas touchees).
update tables
set is_reserve = false, label = null
where number in (38, 39, 40) and is_reserve = true;

-- 2) Creation de la table 41, unique table de reserve desormais.
insert into tables (event_id, number, label, capacity, is_reserve)
select e.id, 41, 'Reserve', 10, true
from events e
where not exists (select 1 from tables where number = 41)
limit 1;
