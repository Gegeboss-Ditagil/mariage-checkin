-- ============================================================================
-- v1.80.0 (11/10/2026) -- demande de Gersom : « met à jour le nom et l'app »
-- (guest-list_68.csv + name-tags et seating-chart seatplan.io du 10/10 (4)).
-- Changements With Joy 67 -> 68, confirmés par le plan seatplan.io :
--  - « Luis Dos » et « Gaby Dos » s'appellent Luis et Gaby Dos Goncalves ;
--  - les 3 « Accompagnant non-nommé » de Nadia Mabata sont nommés : Sofiane,
--    Mernad et Diklavin Mabata (table 38) ; Merline Mabata, du même groupe
--    With Joy, est assise à la table 40 sur le plan -> fiche séparée, table 40 ;
--  - Edoly Lukoki retirée de With Joy et du plan : Famille Lukoki 5 -> 4.
-- Le plan (name tags + seating chart) fait foi sur 3 placements où les
-- étiquettes du CSV sont restées anciennes : Sofiane Mabata table 38 (CSV
-- T040), Eude Matondo table 31 (CSV T036), Luzolo Patrick Menga table 36
-- (CSV T031). Orthographe « Diklavin » du plan (With Joy écrit « Dikalvin »).
-- Tables 2, 31, 36, 38 et 40 restent à 10/10.
--
-- Aucune de ces invitations n'a d'arrivée ni de ligne nominative.
-- Sauvegarde : import_backups (snapshot->>'kind' = 'v1.80.0_guest_list_68')
-- AVANT toute écriture. Retour arrière : réécrire nom_affichage, groupe,
-- table_id, tags, notes et nombre_prevu depuis l'instantané, puis supprimer
-- la fiche « Merline Mabata ».
-- Idempotente : rejouée, elle ne change plus rien.
-- ============================================================================

do $$
declare
  v_event uuid;
  v_t31 uuid;
  v_t36 uuid;
  v_t40 uuid;
begin
  select id into v_event from events limit 1;
  select id into v_t31 from tables where event_id = v_event and number = 31;
  select id into v_t36 from tables where event_id = v_event and number = 36;
  select id into v_t40 from tables where event_id = v_event and number = 40;

  if not exists (select 1 from import_backups where snapshot->>'kind' = 'v1.80.0_guest_list_68') then
    insert into import_backups (event_id, agent_id, snapshot, invitations_count)
    select v_event, null, jsonb_build_object(
      'kind', 'v1.80.0_guest_list_68',
      'invitations', (select jsonb_agg(to_jsonb(i)) from invitations i where i.id in (
        'ce304e61-111f-4563-8116-8f0c483edae4', -- Famille Dos (Luis, Gaby)
        '80bab7de-a9c6-434e-a26e-6b226edc4b4f', -- Famille non-nommé (Nadia Mabata + 3)
        '75816774-ff9a-4f50-804f-1123c5e86010', -- Famille Lukoki
        'a7eeb387-7a67-4536-8b9b-af3706766d64', -- Eude Matondo
        '12af1c98-3fc3-47f9-84c7-bde5ac653513'  -- Luzolo Patrick Menga
      ))
    ), (select count(*) from invitations where event_id = v_event);
  end if;

  -- Luis et Gaby Dos Goncalves (table 2).
  update invitations
     set nom_affichage = 'Luis & Gaby Dos Goncalves', groupe = 'Dos Goncalves',
         notes = replace(notes, 'Membres: Luis Dos, Gaby Dos', 'Membres: Luis Dos Goncalves, Gaby Dos Goncalves')
   where id = 'ce304e61-111f-4563-8116-8f0c483edae4' and nombre_arrive = 0
     and notes like '%Membres: Luis Dos, Gaby Dos%';

  -- Accompagnants de Nadia Mabata nommés (table 38, 4 places inchangées).
  update invitations
     set nom_affichage = 'Famille Mabata', groupe = 'Mabata',
         notes = replace(notes,
           'Membres: Nadia Mabata, Accompagnant non-nommé, Accompagnant non-nommé, Accompagnant non-nommé',
           'Membres: Nadia Mabata, Sofiane Mabata, Mernad Mabata, Diklavin Mabata')
   where id = '80bab7de-a9c6-434e-a26e-6b226edc4b4f' and nombre_arrive = 0
     and notes like '%Accompagnant non-nommé%';

  -- Merline Mabata : même groupe With Joy, assise à la table 40 sur le plan.
  insert into invitations (event_id, table_id, nom_affichage, groupe, nombre_prevu, notes,
                           telephone, cote, tags, placement_status, withjoy_party_id)
  select v_event, v_t40, 'Merline Mabata', 'Mabata', 1,
         'RSVP: Oui, embarquement confirmé',
         '+33762403859', 'Gege', array['Côté_Gege', 'T040'], 'confirmee',
         'table-038-party-222'
  where not exists (select 1 from invitations where event_id = v_event and nom_affichage = 'Merline Mabata');

  -- Edoly Lukoki retirée (With Joy 68 et plan).
  update invitations
     set nombre_prevu = 4,
         notes = replace(notes, 'Membres: Dany Lukoki, Gladys Lukoki, Edoly Lukoki, Glavina Lukoki, Daryl Lukoki',
                                'Membres: Dany Lukoki, Gladys Lukoki, Glavina Lukoki, Daryl Lukoki')
   where id = '75816774-ff9a-4f50-804f-1123c5e86010' and nombre_arrive = 0
     and notes like '%Edoly Lukoki%';

  -- Échange de table du plan : Eude Matondo -> 31, Luzolo Patrick Menga -> 36.
  update invitations set table_id = v_t31, tags = array['Côté_Gege', 'T031']
   where id = 'a7eeb387-7a67-4536-8b9b-af3706766d64' and nombre_arrive = 0;
  update invitations set table_id = v_t36, tags = array['Côté_Gege', 'T036']
   where id = '12af1c98-3fc3-47f9-84c7-bde5ac653513' and nombre_arrive = 0;
end $$;
