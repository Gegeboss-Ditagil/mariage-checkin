-- ============================================================================
-- Gestion des excedents deja affectes a une table de reserve : retirer une
-- affectation, ou la deplacer vers une autre table de reserve. Necessaire
-- car les tables peuvent bouger avant/pendant l'evenement (une table de
-- reserve peut etre reorganisee, ou un excedent doit changer de table).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- unassign_overflow : retire une affectation d'excedent (libere la place sur
-- la table de reserve). Verrouille la ligne pour eviter les conflits.
-- ----------------------------------------------------------------------------
create or replace function unassign_overflow(
  p_assignment_id uuid,
  p_agent_id uuid
) returns void as $$
declare
  v_assign overflow_assignments;
begin
  select * into v_assign from overflow_assignments where id = p_assignment_id for update;

  if not found then
    raise exception 'assignment_not_found';
  end if;

  delete from overflow_assignments where id = p_assignment_id;

  insert into audit_logs (
    event_id, action, invitation_id, table_id, agent_id,
    nombre_personnes, origin_table_id, reserve_table_id, details
  ) values (
    v_assign.event_id, 'overflow_unassign', v_assign.invitation_id, v_assign.origin_table_id, p_agent_id,
    v_assign.nombre_personnes, v_assign.origin_table_id, v_assign.reserve_table_id,
    jsonb_build_object('assignment_id', v_assign.id)
  );
end;
$$ language plpgsql set search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- move_overflow : deplace une affectation d'excedent existante vers une autre
-- table de reserve. Verifie la capacite disponible sur la nouvelle table de
-- facon atomique (meme logique que assign_overflow).
-- ----------------------------------------------------------------------------
create or replace function move_overflow(
  p_assignment_id uuid,
  p_new_reserve_table_id uuid,
  p_agent_id uuid
) returns overflow_assignments as $$
declare
  v_assign overflow_assignments;
  v_capacity int;
  v_used int;
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

  select coalesce(sum(nombre_personnes), 0) into v_used
    from overflow_assignments where reserve_table_id = p_new_reserve_table_id;

  if v_used + v_assign.nombre_personnes > v_capacity then
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
