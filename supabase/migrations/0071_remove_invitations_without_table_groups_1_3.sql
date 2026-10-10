-- ============================================================================
-- v1.79.1 (10/10/2026) -- demande explicite de Gersom : « Groupe 1 delete /
-- groupe 2 delete / groupe 3 delete ».
--
-- Neuf invitations SANS TABLE, 0 arrivée, aucun scan, aucun excédent :
--  Groupe 1 (« ne viendra pas ») : Ya Dany Culumbu, Rene Herrera,
--    Henry karl Jeantine, Famille Nzuzi Culumbu (Tia + Epoux),
--    Famille Lumbu (Helga, Lina), Famille Lumbu (Dislon, Manucho).
--  Groupe 2 (sans table, attendus) : Waku Menga, Flora Landu.
--  Groupe 3 (fiche fantôme, nombre_prevu = 0) : Odette Muzezenu mulumba
--    (PAS « Odette Manuel », table 31, qui reste).
-- Aucune n'apparaît dans guest-list_65.csv ni sur le plan seatplan.io du
-- 10/10/2026.
--
-- Les lignes guests sont supprimées d'abord (invitation_guests part en
-- CASCADE ; guests ne serait pas supprimé tout seul). audit_logs, exceptions et
-- guest_approval_requests passent à NULL (ON DELETE SET NULL).
-- Sauvegarde : import_backups (snapshot->>'kind' = 'v1.79.1_sans_table')
-- AVANT toute écriture. Retour arrière : réinsérer invitations, guests et
-- invitation_guests depuis cet instantané.
-- Garde-fous : identifiant exact ET sans table ET 0 arrivée ET aucun scan.
-- Idempotente : rejouée, elle ne fait rien.
-- ============================================================================

do $$
declare
  v_event uuid;
begin
  drop table if exists tmp_remove_inv, tmp_remove_guests;
  create temporary table tmp_remove_inv on commit drop as
  select i.id, i.event_id
  from invitations i
  where i.id in (
      '436ae25a-4e88-4b98-bea3-c45c234388da', -- Ya Dany Culumbu
      'd49c39b4-0d75-4ddb-aee1-357762bf1826', -- Rene Herrera
      '0ba15a25-1456-4a02-8b26-60149e279d20', -- Henry karl Jeantine
      '9794f92d-b344-48f9-b224-fe4865ed33e0', -- Famille Nzuzi Culumbu
      'ffca5b2d-1b86-40ba-ab82-3c8ff53fe998', -- Famille Lumbu (Helga, Lina)
      '4019e529-9444-400c-97dc-e46d27de8050', -- Famille Lumbu (Dislon, Manucho)
      '2280e87d-7697-40ad-94e7-25e836845c43', -- Waku Menga
      '20759b7c-7737-48ab-b80e-e19f376164d7', -- Flora Landu
      '04eb0358-fb1e-4d75-b7e3-f9eaf1dc2ead'  -- Odette Muzezenu mulumba
    )
    and i.table_id is null
    and i.nombre_arrive = 0
    and not exists (select 1 from checkins c where c.invitation_id = i.id)
    and not exists (select 1 from overflow_assignments o where o.invitation_id = i.id);

  if not exists (select 1 from tmp_remove_inv) then
    return;
  end if;

  select event_id into v_event from tmp_remove_inv limit 1;

  create temporary table tmp_remove_guests on commit drop as
  select ig.guest_id
  from invitation_guests ig
  where ig.invitation_id in (select id from tmp_remove_inv)
    and not exists (
      select 1 from invitation_guests other
      where other.guest_id = ig.guest_id
        and other.invitation_id not in (select id from tmp_remove_inv)
    );

  if not exists (select 1 from import_backups where snapshot->>'kind' = 'v1.79.1_sans_table') then
    insert into import_backups (event_id, agent_id, snapshot, invitations_count)
    select v_event, null, jsonb_build_object(
      'kind', 'v1.79.1_sans_table',
      'invitations', (select jsonb_agg(to_jsonb(i)) from invitations i where i.id in (select id from tmp_remove_inv)),
      'guests', (select jsonb_agg(to_jsonb(g)) from guests g where g.id in (select guest_id from tmp_remove_guests)),
      'invitation_guests', (select jsonb_agg(to_jsonb(ig)) from invitation_guests ig
                            where ig.invitation_id in (select id from tmp_remove_inv))
    ), (select count(*) from invitations where event_id = v_event);
  end if;

  delete from guests where id in (select guest_id from tmp_remove_guests);
  delete from invitations where id in (select id from tmp_remove_inv);
end $$;
