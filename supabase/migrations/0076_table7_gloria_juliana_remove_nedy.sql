-- ============================================================================
-- v1.80.1 (11/10/2026) -- suite de 0075, décision de Gersom sur le plan
-- seatplan.io du 10/10 (6) et guest-list_70.csv : « Enlève Nedy Simao
-- complètement, je l'ai aussi retiré de With Joy » et « remplace une des deux
-- Gloria Culumbu par Juliana Culumbu ».
--  - Nedy Simao (table 7) supprimée : 0 arrivée, aucun scan, aucune ligne
--    nominative ;
--  - Famille Culumbu (table 7) : « Filho 5 Culumbu » devient Juliana Culumbu
--    (With Joy) et Gloria Culumbu est ajoutée (siège laissé par Nedy Simao sur
--    le plan) : 6 -> 7 places. Gloria Culumbu n'est pas encore dans With Joy 70.
-- Table 7 reste à 10/10.
--
-- Sauvegarde : import_backups (snapshot->>'kind' = 'v1.80.1_table7_nedy')
-- AVANT toute écriture. Retour arrière : réinsérer Nedy Simao et réécrire la
-- Famille Culumbu depuis l'instantané.
-- Idempotente.
-- ============================================================================

do $$
declare
  v_event uuid;
begin
  select id into v_event from events limit 1;

  if not exists (select 1 from import_backups where snapshot->>'kind' = 'v1.80.1_table7_nedy') then
    insert into import_backups (event_id, agent_id, snapshot, invitations_count)
    select v_event, null, jsonb_build_object(
      'kind', 'v1.80.1_table7_nedy',
      'invitations', (select jsonb_agg(to_jsonb(i)) from invitations i where i.id in (
        'ed3cad18-a937-4f9a-8b59-6bb3742b0fd0', -- Nedy Simao
        '41166245-159e-4d3d-9206-84c40e141b74'  -- Famille Culumbu (table 7)
      ))
    ), (select count(*) from invitations where event_id = v_event);
  end if;

  update invitations
     set nombre_prevu = 7,
         notes = replace(notes, 'Merveille Culumbu, Filho 5 Culumbu', 'Merveille Culumbu, Juliana Culumbu, Gloria Culumbu')
   where id = '41166245-159e-4d3d-9206-84c40e141b74' and nombre_arrive = 0
     and notes like '%Filho 5 Culumbu%';

  delete from invitations i
  where i.id = 'ed3cad18-a937-4f9a-8b59-6bb3742b0fd0'
    and i.nom_affichage = 'Nedy Simao'
    and i.nombre_arrive = 0
    and not exists (select 1 from checkins c where c.invitation_id = i.id)
    and not exists (select 1 from overflow_assignments o where o.invitation_id = i.id)
    and not exists (select 1 from invitation_guests ig where ig.invitation_id = i.id);
end $$;
