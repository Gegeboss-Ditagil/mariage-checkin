-- ============================================================================
-- Reinverse la migration 0061, deux jours plus tard : la table 42 redevient
-- l'unique table de reserve, la table 41 redevient une table normale.
--
-- Nouvelle structure (export seatplan.io final + guest-list_58.csv transmis
-- par Gersom le 06/10/2026, confirmant un plan de table deja redessine
-- directement sur seatplan.io) : la table 41 est desormais occupee par un
-- vrai groupe de convives (famille Landu + ajouts), la table 42 (vide sur le
-- PDF, aucun tag F042/T042 dans le CSV) reprend le role de reserve
-- "excedentaire". 41 tables normales (1-41) + 1 reserve (42) = 42 tables au
-- total. Capacite officielle : 41 x 10 = 410 places. Capacite maximale
-- absolue avec la reserve : 42 x 10 = 420.
--
-- Confirme explicitement par Gersom avant d'ecrire quoi que ce soit (la
-- bascule contredisait une decision prise 2 jours plus tot en 0061) :
-- "Oui, bascule confirmee".
--
-- La table 42 n'avait pas ete supprimee en 0061 (decommissionnee seulement,
-- capacity=0) precisement pour ce genre de retournement -- aucune perte de
-- donnee d'audit a gerer ici, contrairement a une suppression.
--
-- Idempotente : peut etre rejouee sans effet si deja appliquee.
-- ============================================================================

-- 1) La table 41 redevient une table normale.
update tables
set is_reserve = false
where number = 41 and is_reserve = true;

-- 2) La table 42 redevient l'unique reserve, capacite restauree a 10.
update tables
set is_reserve = true, capacity = 10, label = null
where number = 42 and (is_reserve = false or capacity <> 10 or label is distinct from null);
