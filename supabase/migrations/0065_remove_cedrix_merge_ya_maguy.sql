-- ============================================================================
-- v1.71.2 (07/10/2026) -- demandes explicites de Gersom :
--   « supprime Cedrix » ; « Ya Maguy est en réalité Celestina Mundanda Nsita »
--   (capture With Joy : « Maguy Celestina Mundanda Nsita », titulaire de la
--   famille, 6 accompagnants, table T028).
--
-- 1) « Cedrix » : faux invité surprise de test (notes « Invité surprise approuvé
--    (placement automatique) », 0 arrivée), cause de la surcapacité de la
--    table 2 (11/10) depuis v1.47.0. Supprimé : sa ligne de membre (guests via
--    invitation_guests, CASCADE) part avec lui ; ses 4 lignes d'audit_logs sont
--    conservées (invitation_id SET NULL).
-- 2) « Ya Maguy Mundanda Nsita » : DOUBLON de « Celestina Mundanda Nsita », déjà
--    comptée dans « Famille Mundanda Nsita » (même téléphone +41789610804, même
--    groupe With Joy table-028-party-166) -- cause de la surcapacité de la
--    table 28 (11/10). Fiche supprimée (aucun membre, aucune arrivée, aucun
--    audit). Le prénom complet With Joy « Maguy Celestina » est repris sur la
--    fiche de la famille (liste « Membres: » + ligne de membre) pour que la
--    recherche « Maguy » la retrouve.
--
-- Sauvegarde : copie complète des lignes supprimées/modifiées dans
-- import_backups (snapshot->>'kind' = 'v1.71.2_cedrix_maguy') AVANT toute
-- écriture. Retour arrière : réinsérer depuis cet instantané.
-- Idempotente : peut être rejouée sans effet si déjà appliquée.
-- ============================================================================

do $$
declare
  v_event uuid;
begin
  select id into v_event from events limit 1;

  if not exists (select 1 from import_backups where snapshot->>'kind' = 'v1.71.2_cedrix_maguy') then
    insert into import_backups (event_id, agent_id, snapshot, invitations_count)
    select v_event, null, jsonb_build_object(
      'kind', 'v1.71.2_cedrix_maguy',
      'invitations', (select jsonb_agg(to_jsonb(i)) from invitations i
                      where i.event_id = v_event
                        and i.nom_affichage in ('Cedrix', 'Ya Maguy Mundanda Nsita', 'Famille Mundanda Nsita')),
      'invitation_guests', (select jsonb_agg(to_jsonb(ig)) from invitation_guests ig
                            join invitations i on i.id = ig.invitation_id
                            where i.event_id = v_event and i.nom_affichage in ('Cedrix', 'Famille Mundanda Nsita')),
      'guests', (select jsonb_agg(to_jsonb(g)) from guests g
                 join invitation_guests ig on ig.guest_id = g.id
                 join invitations i on i.id = ig.invitation_id
                 where i.event_id = v_event and i.nom_affichage in ('Cedrix', 'Famille Mundanda Nsita'))
    ), (select count(*) from invitations where event_id = v_event);
  end if;

  -- 1) Cedrix (et sa ligne de membre).
  delete from guests g
  using invitation_guests ig, invitations i
  where ig.guest_id = g.id and ig.invitation_id = i.id
    and i.event_id = v_event and i.nom_affichage = 'Cedrix'
    and i.notes like 'Invité surprise approuvé%' and i.nombre_arrive = 0;
  delete from invitations
  where event_id = v_event and nom_affichage = 'Cedrix'
    and notes like 'Invité surprise approuvé%' and nombre_arrive = 0;

  -- 2) Doublon « Ya Maguy » (garde-fous : même téléphone, même groupe, 0 arrivée).
  delete from invitations
  where event_id = v_event and nom_affichage = 'Ya Maguy Mundanda Nsita'
    and telephone = '+41789610804' and withjoy_party_id = 'table-028-party-166'
    and nombre_arrive = 0;

  -- Prénom complet With Joy sur la fiche de la famille.
  update invitations
  set notes = replace(notes, 'Membres: Celestina Mundanda Nsita,', 'Membres: Maguy Celestina Mundanda Nsita,')
  where event_id = v_event and nom_affichage = 'Famille Mundanda Nsita'
    and notes like '%Membres: Celestina Mundanda Nsita,%';
  update guests g
  set prenom = 'Maguy Celestina', nom_affichage = 'Maguy Celestina Mundanda Nsita'
  from invitation_guests ig, invitations i
  where ig.guest_id = g.id and ig.invitation_id = i.id
    and i.event_id = v_event and i.nom_affichage = 'Famille Mundanda Nsita'
    and g.nom_affichage = 'Celestina Mundanda Nsita';
end $$;
