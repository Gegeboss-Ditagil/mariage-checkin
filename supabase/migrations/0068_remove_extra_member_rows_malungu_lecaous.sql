-- ============================================================================
-- v1.74.1 (10/10/2026) -- demande explicite de Gersom : « supprime les noms en
-- trop » (lignes nominatives au-delà de nombre_prevu, signalées en v1.74.0).
--
-- 1) « Famille Malungu » (table 2, nombre_prevu = 2, « Membres: Ruben Kinanga
--    Malungu, Maguy Malungu ») gardait 5 lignes depuis la scission v1.68.1.
--    Retirées : « Sister 1 Malungu » (a sa propre invitation, sans table),
--    « Sister 2 Malungu » et « Keziah Malungu » (Keziah a sa propre invitation
--    « Famille Malungu » table 32 avec Keren). Aucune arrivée, aucun audit.
-- 2) « Famille LeCaous » (table 26, nombre_prevu = 1, « Membres: Cedrik
--    LeCaous ») gardait 2 lignes. Retirée : « Maman Sunette Jean-Baptiste »
--    (statut attendu, 0 arrivée ; ses 2 lignes d'audit de septembre sont
--    conservées telles quelles).
--
-- 3) « Famille Kinanga Malungu » (sans table, 0 arrivée, aucune ligne
--    nominative, aucun check-in) : doublon de « Famille Malungu » table 2 (mêmes
--    membres « Ruben Kinanga Malungu, Maguy Malungu »), ajouté en v1.69.2.
--    Supprimée sur confirmation de Gersom (« oui », 10/10/2026).
--
-- Pour 1) et 2), seules les lignes guests sont supprimées (invitation_guests part en CASCADE) ;
-- les invitations, nombre_prevu et nombre_arrive ne changent pas.
-- Sauvegarde : import_backups (snapshot->>'kind' = 'v1.74.1_extra_members')
-- AVANT toute écriture. Retour arrière : réinsérer invitations, guests et
-- invitation_guests depuis cet instantané. Garde-fous : statut 'attendu', invitation à 0 arrivée.
-- Idempotente : peut être rejouée sans effet si déjà appliquée.
-- ============================================================================

do $$
declare
  v_event uuid;
begin
  select id into v_event from events limit 1;

  create temporary table tmp_extra_members on commit drop as
  select g.id as guest_id, ig.invitation_id
  from guests g
  join invitation_guests ig on ig.guest_id = g.id
  join invitations i on i.id = ig.invitation_id
  join tables t on t.id = i.table_id
  where i.event_id = v_event
    and g.arrival_status = 'attendu'
    and i.nombre_arrive = 0
    and (
      (i.nom_affichage = 'Famille Malungu' and t.number = 2
        and g.nom_affichage in ('Sister 1 Malungu', 'Sister 2 Malungu', 'Keziah Malungu'))
      or (i.nom_affichage = 'Famille LeCaous' and t.number = 26
        and g.nom_affichage = 'Maman Sunette Jean-Baptiste')
    );

  create temporary table tmp_duplicate_invitations on commit drop as
  select i.id
  from invitations i
  where i.event_id = v_event
    and i.nom_affichage = 'Famille Kinanga Malungu'
    and i.table_id is null
    and i.nombre_arrive = 0
    and i.notes like '%Membres: Ruben Kinanga Malungu, Maguy Malungu%'
    and not exists (select 1 from invitation_guests ig where ig.invitation_id = i.id)
    and not exists (select 1 from checkins c where c.invitation_id = i.id)
    and not exists (select 1 from overflow_assignments o where o.invitation_id = i.id);

  if not exists (select 1 from tmp_extra_members) and not exists (select 1 from tmp_duplicate_invitations) then
    return;
  end if;

  if not exists (select 1 from import_backups where snapshot->>'kind' = 'v1.74.1_extra_members') then
    insert into import_backups (event_id, agent_id, snapshot, invitations_count)
    select v_event, null, jsonb_build_object(
      'kind', 'v1.74.1_extra_members',
      'invitations', (select jsonb_agg(to_jsonb(i)) from invitations i where i.id in (select id from tmp_duplicate_invitations)),
      'guests', (select jsonb_agg(to_jsonb(g)) from guests g where g.id in (select guest_id from tmp_extra_members)),
      'invitation_guests', (select jsonb_agg(to_jsonb(ig)) from invitation_guests ig
                            where ig.guest_id in (select guest_id from tmp_extra_members))
    ), (select count(*) from invitations where event_id = v_event);
  end if;

  delete from guests where id in (select guest_id from tmp_extra_members);
  delete from invitations where id in (select id from tmp_duplicate_invitations);
end $$;
