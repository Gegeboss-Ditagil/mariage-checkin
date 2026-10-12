-- ============================================================================
-- v1.82.6 (11/10/2026) -- demande de Gersom : « Famille Mpiassa » (4 personnes,
-- RSVP « Peut-être », sans table) est marquée « ne viendra pas ».
--
-- Elle sort des invités attendus et des calculs de capacité ; réversible depuis
-- l'application (« ne viendra pas » se décoche sur la fiche) ou par
-- `update invitations set ne_viendra_pas = false where id = '...'`.
-- Garde-fous : identifiant exact ET sans table ET 0 arrivée ET aucun scan ET
-- aucun excédent. Sauvegarde : import_backups (snapshot->>'kind' =
-- 'v1.82.6_mpiassa'). Idempotente : rejouée, elle ne fait rien.
-- ============================================================================

do $$
declare
  v_inv invitations%rowtype;
begin
  select * into v_inv
  from invitations i
  where i.id = 'ce0c540d-678f-46f9-b16c-c20097bef5a5'
    and i.nom_affichage = 'Famille Mpiassa'
    and i.table_id is null
    and i.nombre_arrive = 0
    and not i.ne_viendra_pas
    and not exists (select 1 from checkins c where c.invitation_id = i.id)
    and not exists (select 1 from overflow_assignments o where o.invitation_id = i.id);

  if not found then
    return;
  end if;

  if not exists (select 1 from import_backups where snapshot->>'kind' = 'v1.82.6_mpiassa') then
    insert into import_backups (event_id, agent_id, snapshot, invitations_count)
    values (v_inv.event_id, null,
            jsonb_build_object('kind', 'v1.82.6_mpiassa', 'invitations', jsonb_build_array(to_jsonb(v_inv))),
            (select count(*) from invitations where event_id = v_inv.event_id));
  end if;

  update invitations set ne_viendra_pas = true where id = v_inv.id;
end $$;
