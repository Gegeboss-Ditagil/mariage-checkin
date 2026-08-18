-- ============================================================================
-- Fonctions transactionnelles — evitent les doubles entrees quand plusieurs
-- agents valident en meme temps (row-level lock via SELECT ... FOR UPDATE).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- record_checkin : enregistre une arrivee (ou une correction) de facon atomique.
-- Recalcule le statut automatiquement. Retourne l'invitation a jour.
-- ----------------------------------------------------------------------------
create or replace function record_checkin(
  p_invitation_id uuid,
  p_agent_id uuid,
  p_nombre_personnes int,       -- nombre de PERSONNES QUI ENTRENT MAINTENANT (pas le total)
  p_is_correction boolean default false,
  p_absolute_total int default null -- si fourni (correction), remplace le total au lieu d'additionner
) returns invitations as $$
declare
  v_inv invitations;
  v_ancien int;
  v_nouveau int;
  v_statut text;
begin
  -- Verrouille la ligne pour empecher deux agents de lire/ecrire en meme temps
  select * into v_inv from invitations where id = p_invitation_id for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  v_ancien := v_inv.nombre_arrive;

  if p_absolute_total is not null then
    v_nouveau := p_absolute_total;
  else
    v_nouveau := v_ancien + p_nombre_personnes;
  end if;

  if v_nouveau < 0 then
    raise exception 'negative_total_not_allowed';
  end if;

  if v_nouveau = 0 then
    v_statut := 'non_arrive';
  elsif v_nouveau < v_inv.nombre_prevu then
    v_statut := 'partiel';
  elsif v_nouveau = v_inv.nombre_prevu then
    v_statut := 'complet';
  else
    v_statut := 'excedent';
  end if;

  update invitations
    set nombre_arrive = v_nouveau,
        statut = v_statut
    where id = p_invitation_id
    returning * into v_inv;

  insert into checkins (
    event_id, invitation_id, agent_id, nombre_personnes,
    ancien_total, nouveau_total, is_correction
  ) values (
    v_inv.event_id, p_invitation_id, p_agent_id,
    greatest(abs(v_nouveau - v_ancien), 1),
    v_ancien, v_nouveau, p_is_correction
  );

  insert into audit_logs (
    event_id, action, invitation_id, table_id, agent_id,
    nombre_personnes, ancien_total, nouveau_total, details
  ) values (
    v_inv.event_id,
    case when p_is_correction then 'correction' else 'checkin' end,
    p_invitation_id, v_inv.table_id, p_agent_id,
    v_nouveau - v_ancien, v_ancien, v_nouveau,
    jsonb_build_object('nom_affichage', v_inv.nom_affichage)
  );

  return v_inv;
end;
$$ language plpgsql;

-- ----------------------------------------------------------------------------
-- cancel_last_checkin : annule le dernier enregistrement d'une invitation
-- ----------------------------------------------------------------------------
create or replace function cancel_last_checkin(
  p_invitation_id uuid,
  p_agent_id uuid
) returns invitations as $$
declare
  v_last checkins;
  v_inv invitations;
begin
  select * into v_last from checkins
    where invitation_id = p_invitation_id and cancelled = false
    order by created_at desc
    limit 1
    for update;

  if not found then
    raise exception 'no_checkin_to_cancel';
  end if;

  update checkins set cancelled = true where id = v_last.id;

  -- Revient au total d'avant ce checkin
  return record_checkin(p_invitation_id, p_agent_id, 0, true, v_last.ancien_total);
end;
$$ language plpgsql;

-- ----------------------------------------------------------------------------
-- assign_overflow : assigne des personnes supplementaires a une table de reserve,
-- verifie la capacite disponible de facon atomique.
-- ----------------------------------------------------------------------------
create or replace function assign_overflow(
  p_invitation_id uuid,
  p_reserve_table_id uuid,
  p_nombre_personnes int,
  p_agent_id uuid
) returns overflow_assignments as $$
declare
  v_capacity int;
  v_used int;
  v_inv invitations;
  v_result overflow_assignments;
begin
  select capacity into v_capacity from tables where id = p_reserve_table_id for update;

  if not found then
    raise exception 'reserve_table_not_found';
  end if;

  select coalesce(sum(nombre_personnes), 0) into v_used
    from overflow_assignments where reserve_table_id = p_reserve_table_id;

  if v_used + p_nombre_personnes > v_capacity then
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
$$ language plpgsql;
