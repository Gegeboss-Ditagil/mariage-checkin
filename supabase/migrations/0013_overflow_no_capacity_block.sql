-- ============================================================================
-- Retire le blocage strict de capacite sur assign_overflow / move_overflow.
--
-- Pourquoi : la capacite affichee est calculee a partir du nombre de
-- personnes PREVUES (invitations.nombre_prevu), pas du nombre de personnes
-- reellement arrivees. Sur le terrain, une table peut donc afficher
-- "complete" alors que plusieurs des invites prevus a cette table ne se sont
-- pas presentes et que des places sont en realite libres -- les agents ont
-- besoin de pouvoir y placer un excedent quand ils savent (ou constatent)
-- que ces places resteront vides. Bloquer empecherait totalement cette
-- gestion tres frequente le jour J.
--
-- Ce meme choix a deja ete fait pour move_invitation_table (voir
-- 0008_move_invitation.sql, meme raisonnement). Les fonctions ci-dessous
-- retirent le "raise exception 'reserve_table_full'" mais conservent tout le
-- reste (verification d'existence de la table, journal d'audit, etc.). La
-- capacite reste affichee cote interface comme avertissement, pas comme
-- blocage.
-- ============================================================================

create or replace function assign_overflow(
  p_invitation_id uuid,
  p_reserve_table_id uuid,
  p_nombre_personnes int,
  p_agent_id uuid
) returns overflow_assignments as $$
declare
  v_inv invitations;
  v_result overflow_assignments;
begin
  if not exists (select 1 from tables where id = p_reserve_table_id) then
    raise exception 'reserve_table_not_found';
  end if;

  select * into v_inv from invitations where id = p_invitation_id;

  insert into overflow_assignments (
    event_id, invitation_id, origin_table_id, reserve_table_id, nombre_personnes, agent_id
  ) values (
    v_inv.event_id, p_invitation_id, v_inv.table_id, p_reserve_table_id, p_nombre_personnes, p_agent_id
  ) returning * into v_result;

  insert into audit_logs (
    event_id, action, invitation_id, table_id, agent_id,
    nombre_personnes, origin_table_id, reserve_table_id, details
  ) values (
    v_inv.event_id, 'overflow_assign', p_invitation_id, v_inv.table_id, p_agent_id,
    p_nombre_personnes, v_inv.table_id, p_reserve_table_id,
    jsonb_build_object('nom_affichage', v_inv.nom_affichage)
  );

  return v_result;
end;
$$ language plpgsql set search_path = public, pg_temp;

create or replace function move_overflow(
  p_assignment_id uuid,
  p_new_reserve_table_id uuid,
  p_agent_id uuid
) returns overflow_assignments as $$
declare
  v_assign overflow_assignments;
  v_result overflow_assignments;
begin
  select * into v_assign from overflow_assignments where id = p_assignment_id for update;

  if not found then
    raise exception 'assignment_not_found';
  end if;

  if v_assign.reserve_table_id = p_new_reserve_table_id then
    raise exception 'same_table';
  end if;

  if not exists (select 1 from tables where id = p_new_reserve_table_id) then
    raise exception 'reserve_table_not_found';
  end if;

  update overflow_assignments
    set reserve_table_id = p_new_reserve_table_id
    where id = p_assignment_id
    returning * into v_result;

  insert into audit_logs (
    event_id, action, invitation_id, table_id, agent_id,
    nombre_personnes, origin_table_id, reserve_table_id, details
  ) values (
    v_result.event_id, 'overflow_move', v_result.invitation_id, v_result.origin_table_id, p_agent_id,
    v_result.nombre_personnes, v_result.origin_table_id, p_new_reserve_table_id,
    jsonb_build_object(
      'assignment_id', v_result.id,
      'ancienne_table_reserve_id', v_assign.reserve_table_id,
      'nouvelle_table_reserve_id', p_new_reserve_table_id
    )
  );

  return v_result;
end;
$$ language plpgsql set search_path = public, pg_temp;
