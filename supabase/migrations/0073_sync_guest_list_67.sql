-- ============================================================================
-- v1.79.3 (11/10/2026) -- demande de Gersom : « withjoy corrected go update »
-- (guest-list_67.csv). With Joy concorde désormais avec le plan seatplan.io du
-- 10/10/2026 sur les derniers écarts de la v1.79.2 :
--  - Danyl Mbidi -> table 6, Pajos Mpapa -> table 13 (échange) ;
--  - Jean-Clivens Le Caous et Cedrik LeCaous -> table 27 ;
--  - Frank Mbonda et Mademoissele Isokolele retirés de With Joy : fiche
--    Frank Mbonda supprimée, Famille Isolokele ramenée à Karl Isolokele ;
--  - Aissatou et Mariame Doumbia ajoutées (« Famille Doumbia », table 26).
-- Tables 6, 13, 26 et 27 restent à 10/10. Seul écart restant : Steven Kimbau
-- (With Joy table 31, absent du plan et de l'application).
--
-- Aucune de ces invitations n'a d'arrivée ni de ligne nominative.
-- Sauvegarde : import_backups (snapshot->>'kind' = 'v1.79.3_guest_list_67')
-- AVANT toute écriture. Retour arrière : réécrire table_id, tags, notes et
-- nombre_prevu depuis l'instantané, réinsérer Frank Mbonda, supprimer la
-- Famille Doumbia (withjoy_party_id 'person-invitee-P3bJZ14BhtFVD3I6oU1').
-- Idempotente : rejouée, elle ne change plus rien.
-- ============================================================================

do $$
declare
  v_event uuid;
  v_t6 uuid;
  v_t13 uuid;
  v_t26 uuid;
  v_t27 uuid;
begin
  select id into v_event from events limit 1;
  select id into v_t6 from tables where event_id = v_event and number = 6;
  select id into v_t13 from tables where event_id = v_event and number = 13;
  select id into v_t26 from tables where event_id = v_event and number = 26;
  select id into v_t27 from tables where event_id = v_event and number = 27;

  if not exists (select 1 from import_backups where snapshot->>'kind' = 'v1.79.3_guest_list_67') then
    insert into import_backups (event_id, agent_id, snapshot, invitations_count)
    select v_event, null, jsonb_build_object(
      'kind', 'v1.79.3_guest_list_67',
      'invitations', (select jsonb_agg(to_jsonb(i)) from invitations i where i.id in (
        'e2439e2f-6b2e-49a5-a3dd-c71112518b54', -- Danyl Mbidi
        '39ca9805-fa87-4c5d-a7c8-d0c954236cdf', -- Pajos Mpapa
        '2d294551-c3c1-4324-bd6d-90b8f682874e', -- Famille LeCaous
        '4424084e-d5de-42f3-a3f4-f704d57c41ff', -- Jean-Clivens Le Caous
        'aeb57aff-5677-414d-b211-69347d234e23', -- Famille Isolokele
        '0996fe8a-4d6a-47d3-96a5-1bbc5cdf6ff1'  -- Frank Mbonda
      ))
    ), (select count(*) from invitations where event_id = v_event);
  end if;

  -- Échange Danyl Mbidi (-> 6) / Pajos Mpapa (-> 13).
  update invitations set table_id = v_t6, tags = array_replace(tags, 'T013', 'F006')
    where id = 'e2439e2f-6b2e-49a5-a3dd-c71112518b54' and nombre_arrive = 0;
  update invitations set table_id = v_t13, tags = array_replace(tags, 'F006', 'T013')
    where id = '39ca9805-fa87-4c5d-a7c8-d0c954236cdf' and nombre_arrive = 0;

  -- Les deux LeCaous -> table 27.
  update invitations set table_id = v_t27, tags = array_replace(tags, 'T026', 'T027')
    where id = '2d294551-c3c1-4324-bd6d-90b8f682874e' and nombre_arrive = 0;
  update invitations set table_id = v_t27, tags = array_replace(tags, 'F001', 'T027')
    where id = '4424084e-d5de-42f3-a3f4-f704d57c41ff' and nombre_arrive = 0;

  -- Mademoissele Isokolele retirée de With Joy.
  update invitations set nombre_prevu = 1,
      notes = replace(notes, 'Membres: Karl Isolokele, Mademoissele Isokolele', 'Membres: Karl Isolokele')
    where id = 'aeb57aff-5677-414d-b211-69347d234e23' and nombre_arrive = 0
      and notes like '%Mademoissele Isokolele%';

  -- Aissatou et Mariame Doumbia, table 26 (plan et With Joy).
  insert into invitations (event_id, table_id, nom_affichage, groupe, nombre_prevu, notes,
                           telephone, cote, tags, placement_status, withjoy_party_id)
  select v_event, v_t26, 'Famille Doumbia', 'Doumbia', 2,
         'RSVP: Sans réponse | Membres: Aissatou Doumbia, Mariame Doumbia',
         '+33615284882', 'Gege', array['Côté_Gege', 'T026'], 'confirmee',
         'person-invitee-P3bJZ14BhtFVD3I6oU1'
  where not exists (select 1 from invitations where withjoy_party_id = 'person-invitee-P3bJZ14BhtFVD3I6oU1');

  -- Frank Mbonda retiré de With Joy et absent du plan (0 arrivée, aucun scan,
  -- aucune ligne nominative).
  delete from invitations i
  where i.id = '0996fe8a-4d6a-47d3-96a5-1bbc5cdf6ff1'
    and i.nombre_arrive = 0
    and not exists (select 1 from checkins c where c.invitation_id = i.id)
    and not exists (select 1 from overflow_assignments o where o.invitation_id = i.id)
    and not exists (select 1 from invitation_guests ig where ig.invitation_id = i.id);
end $$;
