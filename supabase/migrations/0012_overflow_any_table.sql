-- ============================================================================
-- Permet d'assigner un excedent (ou de le deplacer) vers N'IMPORTE QUELLE
-- table, pas seulement une table de reserve. Pour que ce soit sans danger sur
-- une table normale (deja occupee par de vraies invitations), le calcul de
-- capacite doit desormais tenir compte a la fois :
--   - des personnes prevues des invitations deja assignees a cette table
--     (table_id), et
--   - des excedents deja assignes a cette table (overflow_assignments).
-- Avant ce correctif, seul le 2e etait verifie : une table normale deja
-- pleine via ses invitations aurait pu recevoir un excedent sans blocage.
-- ============================================================================

create or replace function assign_overflow(
  p_invitation_id uuid,
  p_reserve_table_id uuid,
  p_nombre_personnes int,
  p_agent_id uuid
) returns overflow_assignments as $$
declare
  v_capacity int;
  v_used_invitations int;
  v_used_overflow int;
  v_inv invitations;
  v_result overflow_assignments;
begin
  select capacity into v_capacity from tables where id = p_reserve_table_id for update;

  if not found then
    raise exception 'reserve_table_not_found';
  end if;

  select coalesce(sum(nombre_prevu), 0) into v_used_invitations
    from invitations where table_id = p_reserve_table_id;

  select coalesce(sum(nombre_personnes), 0) into v_used_overflow
    from overflow_assignments where reserve_table_id = p_reserve_table_id;

  if v_used_invitations + v_used_overflow + p_nombre_personnes > v_capacity then
    raise exception 'reserve_table_full';
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
  v_capacity int;
  v_used_invitations int;
  v_used_overflow int;
  v_result overflow_assignments;
begin
  select * into v_assign from overflow_assignments where id = p_assignment_id for update;

  if not found then
    raise exception 'assignment_not_found';
  end if;

  if v_assign.reserve_table_id = p_new_reserve_table_id then
    raise exception 'same_table';
  end if;

  select capacity into v_capacity from tables where id = p_new_reserve_table_id for update;

  if not found then
    raise exception 'reserve_table_not_found';
  end if;

  select coalesce(sum(nombre_prevu), 0) into v_used_invitations
    from invitations where table_id = p_new_reserve_table_id;

  select coalesce(sum(nombre_personnes), 0) into v_used_overflow
    from overflow_assignments where reserve_table_id = p_new_reserve_table_id;

  if v_used_invitations + v_used_overflow + v_assign.nombre_personnes > v_capacity then
    raise exception 'reserve_table_full';
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
