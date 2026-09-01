-- v1.30.1 - Repare les anciennes invitations dont le compteur agrege existe
-- sans liste nominative complete. Ne modifie jamais les totaux de l'invitation.
create or replace function ensure_invitation_member_rows(
  p_invitation_id uuid,
  p_agent_id uuid
) returns invitations as $$
declare
  v_inv invitations;
  v_existing int;
  v_target int;
  v_index int;
  v_guest_id uuid;
  v_name text;
  v_has_primary boolean;
begin
  select * into v_inv from invitations where id = p_invitation_id for update;
  if not found then raise exception 'invitation_not_found'; end if;

  select count(*) into v_existing from invitation_guests where invitation_id = p_invitation_id;
  select exists (
    select 1 from invitation_guests ig join guests g on g.id = ig.guest_id
    where ig.invitation_id = p_invitation_id and lower(trim(g.nom_affichage)) = lower(trim(v_inv.nom_affichage))
  ) into v_has_primary;
  v_target := greatest(v_inv.nombre_prevu, v_inv.nombre_arrive, 1);

  for v_index in (v_existing + 1)..v_target loop
    v_name := case
      when not v_has_primary then v_inv.nom_affichage
      else 'Accompagnant à nommer ' || v_index
    end;
    v_has_primary := true;
    insert into guests (event_id, nom_affichage, arrival_status)
      values (v_inv.event_id, v_name, case when v_index <= v_inv.nombre_arrive then 'arrive' else 'attendu' end)
      returning id into v_guest_id;
    insert into invitation_guests (invitation_id, guest_id) values (p_invitation_id, v_guest_id);
  end loop;

  -- Pour les anciennes lignes creees avant arrival_status, aligne seulement
  -- le nombre necessaire sur le compteur existant, sans toucher aux X deja poses.
  with ranked as (
    select g.id, row_number() over (order by g.created_at, g.id) as position
    from invitation_guests ig join guests g on g.id = ig.guest_id
    where ig.invitation_id = p_invitation_id and g.arrival_status <> 'ne_viendra_pas'
  )
  update guests g set arrival_status = 'arrive'
  from ranked r where g.id = r.id and r.position <= v_inv.nombre_arrive and g.arrival_status = 'attendu';

  if v_existing < v_target then
    insert into audit_logs (event_id, action, invitation_id, table_id, agent_id, details)
    values (v_inv.event_id, 'members_repair', v_inv.id, v_inv.table_id, p_agent_id,
      jsonb_build_object('avant', v_existing, 'apres', v_target));
  end if;
  return v_inv;
end;
$$ language plpgsql set search_path = public, pg_temp;
