-- ============================================================================
-- v1.80.1 (11/10/2026) -- demande de Gersom : « update commit et merge »
-- (guest-list_69.csv + seating-chart seatplan.io du 10/10 (5)).
-- Seuls les changements sur lesquels With Joy et le plan s'accordent :
--  - table 7, Famille Culumbu : les prénoms réels remplacent « Femme » et
--    « Filho 1/3/4 » (Epouse Gilie, Anderson, Merveille, Angelino Culumbu) ;
--    « Filho 5 Culumbu » reste en attente (With Joy « Juliana », plan
--    « Gloria » -- Gersom corrige) ;
--  - orthographe « Dikalvin Mabata » (With Joy et plan (5)), au lieu de
--    « Diklavin » (plan (4)).
-- Non appliqué, décision de Gersom : Eude Matondo (With Joy T021) reste à la
-- table 31 et Luzolo Patrick Menga (With Joy T026) à la table 36, comme sur le
-- plan ; Julianna Matondo reste à la table 7 (nouveau siège à venir).
-- Aucun nombre de places ni aucune table ne change.
--
-- Aucune arrivée ni ligne nominative sur ces invitations.
-- Sauvegarde : import_backups (snapshot->>'kind' = 'v1.80.1_culumbu_dikalvin')
-- AVANT toute écriture. Retour arrière : réécrire notes depuis l'instantané.
-- Idempotente.
-- ============================================================================

do $$
declare
  v_event uuid;
begin
  select id into v_event from events limit 1;

  if not exists (select 1 from import_backups where snapshot->>'kind' = 'v1.80.1_culumbu_dikalvin') then
    insert into import_backups (event_id, agent_id, snapshot, invitations_count)
    select v_event, null, jsonb_build_object(
      'kind', 'v1.80.1_culumbu_dikalvin',
      'invitations', (select jsonb_agg(to_jsonb(i)) from invitations i where i.id in (
        '41166245-159e-4d3d-9206-84c40e141b74', -- Famille Culumbu (table 7)
        '80bab7de-a9c6-434e-a26e-6b226edc4b4f'  -- Famille Mabata (table 38)
      ))
    ), (select count(*) from invitations where event_id = v_event);
  end if;

  update invitations
     set notes = replace(notes,
       'Membres: Tio Gilie Culumbu, Femme Culumbu, Filho 1 Culumbu, Filho 4 Culumbu, Filho 3 Culumbu, Filho 5 Culumbu',
       'Membres: Tio Gilie Culumbu, Epouse Gilie Culumbu, Anderson Culumbu, Angelino Culumbu, Merveille Culumbu, Filho 5 Culumbu')
   where id = '41166245-159e-4d3d-9206-84c40e141b74' and nombre_arrive = 0
     and notes like '%Femme Culumbu%';

  update invitations
     set notes = replace(notes, 'Diklavin Mabata', 'Dikalvin Mabata')
   where id = '80bab7de-a9c6-434e-a26e-6b226edc4b4f' and nombre_arrive = 0
     and notes like '%Diklavin Mabata%';
end $$;
