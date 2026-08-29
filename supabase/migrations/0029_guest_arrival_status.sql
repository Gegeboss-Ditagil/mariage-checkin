-- ============================================================================
-- Suivi de l'arrivee PAR PERSONNE (et non plus par simple compteur agrege).
-- Demande de Gersom le 29/08/2026, apres avoir vu le panneau "Qui ne vient
-- pas dans ce groupe ?" (deja par-membre) : pour un groupe de 5, le
-- compteur +/- "Personnes arrivees" ne dit jamais QUI parmi les 5 est
-- arrive -- juste un nombre. Remplace par une case a cocher par personne,
-- a trois etats, reversible a tout moment :
--   'attendu'        -- pas encore arrive (etat par defaut)
--   'arrive'         -- coche vert, compte dans nombre_arrive
--   'ne_viendra_pas' -- croix rouge, sa place est liberee de nombre_prevu
--                        (grise dans l'UI, jamais supprime -- toujours
--                        reversible en retapant, contrairement a l'ancien
--                        "Qui ne vient pas" qui SUPPRIMAIT la ligne guest)
-- ============================================================================

alter table guests
  add column if not exists arrival_status text not null default 'attendu'
    check (arrival_status in ('attendu', 'arrive', 'ne_viendra_pas'));

-- ----------------------------------------------------------------------------
-- set_guest_arrival_status : bascule l'etat d'UNE personne du groupe. Calcule
-- lui-meme les deltas sur nombre_prevu (etat ne_viendra_pas) et nombre_arrive
-- (etat arrive) a partir de l'ancien ET du nouvel etat -- gere donc aussi bien
-- attendu<->arrive, attendu<->ne_viendra_pas, que le cas plus rare
-- arrive<->ne_viendra_pas directement. Idempotent (retaper le meme etat ne
-- fait rien). Reutilise le format d'audit de record_checkin (table checkins)
-- uniquement quand nombre_arrive bouge, pour que /history reste coherent.
-- ----------------------------------------------------------------------------
create or replace function set_guest_arrival_status(
  p_guest_id uuid,
  p_agent_id uuid,
  p_status text
) returns invitations as $$
declare
  v_invitation_id uuid;
  v_old_status text;
  v_guest_nom text;
  v_inv invitations;
  v_prevu_delta int := 0;
  v_arrive_delta int := 0;
  v_new_prevu int;
  v_new_arrive int;
  v_statut text;
begin
  if p_status not in ('attendu', 'arrive', 'ne_viendra_pas') then
    raise exception 'invalid_status';
  end if;

  select arrival_status, nom_affichage into v_old_status, v_guest_nom
    from guests where id = p_guest_id for update;
  if not found then
    raise exception 'guest_not_found';
  end if;

  select invitation_id into v_invitation_id from invitation_guests where guest_id = p_guest_id limit 1;
  if v_invitation_id is null then
    raise exception 'guest_not_linked_to_invitation';
  end if;

  select * into v_inv from invitations where id = v_invitation_id for update;
  if not found then
    raise exception 'invitation_not_found';
  end if;

  if v_old_status = p_status then
    return v_inv;
  end if;

  if v_old_status = 'ne_viendra_pas' then v_prevu_delta := v_prevu_delta + 1; end if;
  if v_old_status = 'arrive' then v_arrive_delta := v_arrive_delta - 1; end if;
  if p_status = 'ne_viendra_pas' then v_prevu_delta := v_prevu_delta - 1; end if;
  if p_status = 'arrive' then v_arrive_delta := v_arrive_delta + 1; end if;

  update guests set arrival_status = p_status where id = p_guest_id;

  v_new_prevu := greatest(v_inv.nombre_prevu + v_prevu_delta, 0);
  v_new_arrive := greatest(v_inv.nombre_arrive + v_arrive_delta, 0);

  if v_new_arrive = 0 then v_statut := 'non_arrive';
  elsif v_new_arrive < v_new_prevu then v_statut := 'partiel';
  elsif v_new_arrive = v_new_prevu then v_statut := 'complet';
  else v_statut := 'excedent';
  end if;

  update invitations
    set nombre_prevu = v_new_prevu, nombre_arrive = v_new_arrive, statut = v_statut,
        ne_viendra_pas = case when v_new_arrive > 0 then false else ne_viendra_pas end
    where id = v_invitation_id
    returning * into v_inv;

  if v_arrive_delta <> 0 then
    insert into checkins (event_id, invitation_id, agent_id, nombre_personnes, ancien_total, nouveau_total, is_correction)
      values (
        v_inv.event_id, v_invitation_id, p_agent_id, abs(v_arrive_delta),
        v_inv.nombre_arrive - v_arrive_delta, v_inv.nombre_arrive, v_arrive_delta < 0
      );
  end if;

  insert into audit_logs (event_id, action, invitation_id, table_id, agent_id, details)
    values (
      v_inv.event_id, 'guest_arrival_status', v_invitation_id, v_inv.table_id, p_agent_id,
      jsonb_build_object(
        'guest_id', p_guest_id, 'nom_affichage', v_guest_nom,
        'ancien_statut', v_old_status, 'nouveau_statut', p_status
      )
    );

  return v_inv;
end;
$$ language plpgsql set search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- remove_invitation_member (mise a jour) : une suppression DEFINITIVE depuis
-- "Gerer les membres du groupe" doit rester coherente avec arrival_status,
-- sinon nombre_prevu/nombre_arrive peuvent deriver :
--   - si la personne etait deja 'ne_viendra_pas', sa place est deja liberee
--     de nombre_prevu -- ne PAS le redecrementer une seconde fois.
--   - si la personne etait 'arrive', sa place doit aussi sortir de
--     nombre_arrive (sinon nombre_arrive > nombre_prevu apres suppression).
-- ----------------------------------------------------------------------------
create or replace function remove_invitation_member(
  p_guest_id uuid,
  p_agent_id uuid
) returns invitations as $$
declare
  v_invitation_id uuid;
  v_inv invitations;
  v_guest_nom_affichage text;
  v_guest_status text;
  v_new_prevu int;
  v_new_arrive int;
  v_statut text;
begin
  select invitation_id into v_invitation_id from invitation_guests where guest_id = p_guest_id;

  if v_invitation_id is null then
    raise exception 'member_not_found';
  end if;

  select * into v_inv from invitations where id = v_invitation_id for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  select nom_affichage, arrival_status into v_guest_nom_affichage, v_guest_status from guests where id = p_guest_id;

  delete from invitation_guests where guest_id = p_guest_id;
  delete from guests where id = p_guest_id;

  v_new_prevu := case
    when v_guest_status = 'ne_viendra_pas' then v_inv.nombre_prevu
    else greatest(v_inv.nombre_prevu - 1, 0)
  end;
  v_new_arrive := case
    when v_guest_status = 'arrive' then greatest(v_inv.nombre_arrive - 1, 0)
    else v_inv.nombre_arrive
  end;

  if v_new_arrive = 0 then
    v_statut := 'non_arrive';
  elsif v_new_arrive < v_new_prevu then
    v_statut := 'partiel';
  elsif v_new_arrive = v_new_prevu then
    v_statut := 'complet';
  else
    v_statut := 'excedent';
  end if;

  update invitations set nombre_prevu = v_new_prevu, nombre_arrive = v_new_arrive, statut = v_statut
    where id = v_invitation_id
    returning * into v_inv;

  insert into audit_logs (event_id, action, invitation_id, table_id, agent_id, details)
    values (
      v_inv.event_id, 'member_remove', v_invitation_id, v_inv.table_id, p_agent_id,
      jsonb_build_object('guest_id', p_guest_id, 'nom_affichage', v_guest_nom_affichage)
    );

  return v_inv;
end;
$$ language plpgsql set search_path = public, pg_temp;
