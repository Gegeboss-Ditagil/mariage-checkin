-- ============================================================================
-- Renomme la table 41 (T041, ex-reserve) en "Houston" et la fait passer en
-- table reguliere ; cree la table 42 "Johannesburg" comme nouvelle et unique
-- table de reserve, capacite 10 (identique aux autres).
--
-- Nouvelle structure : 42 tables au total = 41 tables regulieres (1-41) +
-- 1 seule table de reserve (42). Capacite officielle : 41 x 10 = 410 places
-- (au lieu de 40 x 10 = 400 auparavant). Capacite maximale absolue avec la
-- reserve : 42 x 10 = 420.
--
-- Demande explicite de Gersom le 14/09/2026 (nouvelle configuration de
-- placement, cf. plan de table photographie fourni). Deja applique
-- manuellement en production le meme jour -- cette migration documente le
-- changement dans le schema versionne sur GitHub, comme l'exige
-- docs/DATA_CHANGE_INSTRUCTIONS.md (section 10, ne jamais modifier la
-- production sans reporter le changement dans les migrations GitHub).
--
-- Idempotente : peut etre rejouee sans effet si deja appliquee.
-- ============================================================================

-- 1) La table 41 (ex-reserve, "T041") devient une table reguliere "Houston".
update tables
set label = 'Houston', is_reserve = false
where number = 41 and (label is distinct from 'Houston' or is_reserve = true);

-- 2) Creation de la table 42 "Johannesburg", unique table de reserve
--    desormais, meme capacite que les autres (10).
insert into tables (event_id, number, label, capacity, is_reserve, zone)
select t.event_id, 42, 'Johannesburg', 10, true, t.zone
from tables t
where t.number = 41
  and not exists (select 1 from tables where number = 42)
limit 1;
