-- ============================================================================
-- Reinverse la migration 0051 : la table 41 redevient l'unique table de
-- reserve ("excedentaire"), la table 42 ("Johannesburg") est supprimee.
--
-- Nouvelle structure (nouveau plan de salle seatplan.io transmis par Gersom,
-- photos 4 zones NE/NW/SE/SW + guest-list_57.csv, 04-05/10/2026) :
-- 41 tables au total = 40 tables normales (1-40) + 1 seule table de reserve
-- (41). Capacite officielle : 40 x 10 = 400 places. Capacite maximale
-- absolue avec la reserve : 41 x 10 = 410.
--
-- Prealable verifie avant cette migration : les 2 seules invitations qui
-- pointaient encore vers la table 42 (fiches a nombre_prevu=0, aucun
-- overflow_assignment/guest_approval ne reference cette table) ont deja ete
-- remises a table_id = null par la mise a jour de placement groupee du meme
-- lot (voir CHANGELOG).
--
-- IMPORTANT : la table 42 N'EST PAS supprimee, contrairement a l'intention
-- initiale. 13 lignes de audit_logs.table_id (SET NULL on delete) la
-- referencent encore (actions reelles du 14-17/09/2026 : approbation,
-- assignation, arrivees). La supprimer aurait silencieusement mis ces 13
-- references historiques a null -- une perte d'information d'audit,
-- contraire a la regle du projet de ne jamais toucher a l'audit. La table
-- 42 est donc seulement DECOMMISSIONNEE (capacite 0, plus de reserve, plus
-- utilisable pour un placement) : la ligne reste en base pour que l'audit
-- trail garde un table_id valide et consultable.
--
-- Demande explicite de Gersom (04-05/10/2026, plan de table final). Cf.
-- docs/DATA_CHANGE_INSTRUCTIONS.md section 10 : modification de production
-- deja executee et verifiee, cette migration documente le changement dans
-- le schema versionne sur GitHub.
--
-- Idempotente : peut etre rejouee sans effet si deja appliquee.
-- ============================================================================

-- 1) La table 41 ("Houston") redevient l'unique table de reserve.
update tables
set is_reserve = true, label = null
where number = 41 and (is_reserve = false or label is distinct from null);

-- 2) La table 42 ("Johannesburg") est decommissionnee (plus dans le nouveau
--    plan de salle) mais conservee en base pour l'integrite de l'audit
--    trail : capacite ramenee a 0 (ne peut plus recevoir de placement),
--    n'est plus une reserve.
update tables
set is_reserve = false, capacity = 0, label = 'Supprimee (historique audit uniquement)'
where number = 42 and (is_reserve = true or capacity <> 0 or label is distinct from 'Supprimee (historique audit uniquement)');
