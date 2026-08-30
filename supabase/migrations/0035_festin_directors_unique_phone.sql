-- ============================================================================
-- Contrainte d'unicite sur festin_directors.telephone, appliquee directement
-- en production le 30/08/2026 par Gersom (Supabase SQL Editor) apres que
-- l'insertion des numeros de Remy Landu et Tuzola (0033_festin_directors_contacts.sql)
-- ait ete relancee plusieurs fois via l'agent -- sans contrainte d'unicite,
-- `on conflict do nothing` n'avait aucun arbitre pour se declencher
-- (festin_directors.id est un uuid aleatoire, pas un identifiant naturel), ce
-- qui a cree des doublons (3 copies de chaque directeur). Dedoublonnage
-- manuel (garde la ligne la plus ancienne par telephone) fait au meme moment,
-- non reproduit ici (rien a rejouer, deja fait sur la seule base concernee).
--
-- Cette migration documente la contrainte deja en place, pour que le schema
-- du depot reste la source de verite -- voir CLAUDE.md : "Toute modification
-- manuelle de production doit etre reflétée dans une migration GitHub".
-- ============================================================================

alter table festin_directors add constraint festin_directors_telephone_key unique (telephone);
