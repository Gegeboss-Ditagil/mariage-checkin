-- ============================================================================
-- v1.72.0 (07/10/2026) -- demande explicite de Gersom, avec le nouvel export
-- seatplan.io (« seating-chart ... (8).pdf ») : « on va remettre la table 1
-- comme excédentaire, donc 1 et 42 excédentaires ».
--
-- Le PDF (8) redessine la table 42 (vide) dans la colonne de droite du bloc
-- Sud, juste sous la table 1 (le « Couloir Sud – Chapiteau » est réduit en
-- bande pour lui faire la place). 45 tables · 431 places sur seatplan.io.
--
-- Nouvelle structure : 42 tables actives = 40 tables normales (2 à 41,
-- 400 places officielles) + 2 réserves « excédentaires » (table 1 « Maquela
-- do Zombo » et table 42), capacité absolue 420.
--
-- La table 42 avait été désactivée (capacité 0) par 0064, pas supprimée --
-- elle est simplement réactivée : capacité 10, réserve, libellé effacé.
-- La table 1 reste réserve (inchangée). Aucune invitation n'est déplacée.
--
-- Sauvegarde : ligne de la table 42 avant modification dans import_backups
-- (snapshot->>'kind' = 'v1.72.0_reserves_1_42'). Idempotente.
-- ============================================================================

do $$
declare
  v_event uuid;
begin
  select id into v_event from events limit 1;

  if not exists (select 1 from import_backups where snapshot->>'kind' = 'v1.72.0_reserves_1_42') then
    insert into import_backups (event_id, agent_id, snapshot, invitations_count)
    select v_event, null, jsonb_build_object(
      'kind', 'v1.72.0_reserves_1_42',
      'tables', (select jsonb_agg(to_jsonb(t)) from tables t where t.event_id = v_event and t.number in (1, 42))
    ), (select count(*) from invitations where event_id = v_event);
  end if;

  update tables
  set is_reserve = true, capacity = 10, label = null
  where event_id = v_event and number = 42
    and (is_reserve = false or capacity <> 10 or label is not null);

  update tables
  set is_reserve = true
  where event_id = v_event and number = 1 and is_reserve = false;
end $$;
