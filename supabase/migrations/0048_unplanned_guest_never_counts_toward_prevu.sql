-- ============================================================================
-- Corrige un bug de donnees trouve par Gersom le 03/09/2026 (capture d'ecran :
-- une invitation retombe a "PERSONNES PREVUES : 0" apres avoir ajoute puis
-- marque "ne viendra pas" des accompagnants non prevus).
--
-- Racine du bug (v1.39.2, consolidation du "+" de GuestArrivalPanel) :
-- add_unplanned_arrival (0030) insere le nouvel invite directement en
-- 'arrive' SANS jamais toucher nombre_prevu -- c'est voulu, voir 0030. Mais
-- set_guest_arrival_status (0029, les boutons ✓/✕ par personne) suppose que
-- TOUT guest de la liste compte dans nombre_prevu, et decremente
-- nombre_prevu des qu'on bascule quelqu'un vers 'ne_viendra_pas' -- y
-- compris un accompagnant ajoute via add_unplanned_arrival, qui n'a JAMAIS
-- ete compte dedans. Resultat observe : nombre_prevu descend sous son
-- vrai total (jusqu'a 0, jamais negatif grace au greatest(...,0) deja en
-- place) a chaque fois qu'un tel accompagnant est bascule en "ne viendra
-- pas" apres coup.
--
-- Fix : une colonne guests.is_unplanned distingue les deux origines
-- (add_invitation_member/import CSV/reparation -- comptent dans
-- nombre_prevu -- vs add_unplanned_arrival -- ne comptent jamais). Les
-- fonctions qui deplacent nombre_prevu (set_guest_arrival_status,
-- remove_invitation_member, split_guest_to_new_invitation) ignorent
-- desormais ce delta pour un guest is_unplanned = true : seul
-- nombre_arrive bouge pour eux, jamais nombre_prevu, quel que soit leur
-- arrival_status -- y compris apres un deplacement individuel vers une
-- nouvelle invitation (la nouvelle fiche reste "0 prevue / 1 arrivee",
-- coherente avec le fait que cette personne n'a jamais fait partie d'un
-- effectif prevu, plutot que de silencieusement devenir "prevue" au
-- passage.
-- ============================================================================

alter table guests add column if not exists is_unplanned boolean not null default false;

create or replace function add_unplanned_arrival(
  p_invitation_id uuid,
  p_prenom text,
  p_nom text,
  p_agent_id uuid
) returns invitations as $$
declare
  v_inv invitations;
  v_prenom text;
  v_nom text;
  v_affichage text;
  v_guest_id uuid;
  v_new_arrive int;
  v_statut text;
begin
  select * into v_inv from invitations where id = p_invitation_id for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  v_prenom := nullif(trim(both from coalesce(p_prenom, '')), '');
  v_nom := nullif(trim(both from coalesce(p_nom, '')), '');
  v_affichage := nullif(trim(both from (coalesce(v_prenom, '') || ' ' || coalesce(v_nom, ''))), '');

  insert into guests (event_id, nom, prenom, nom_affichage, arrival_status, is_unplanned)
    values (v_inv.event_id, v_nom, v_prenom, coalesce(v_affichage, 'Invité sans nom'), 'arrive', true)
    returning id into v_guest_id;

  insert into invitation_guests (invitation_id, guest_id) values (p_invitation_id, v_guest_id);

  v_new_arrive := v_inv.nombre_arrive + 1;

  if v_new_arrive = 0 then v_statut := 'non_arrive';
  elsif v_new_arrive < v_inv.nombre_prevu then v_statut := 'partiel';
  elsif v_new_arrive = v_inv.nombre_prevu then v_statut := 'complet';
  else v_statut := 'excedent';
  end if;

  update invitations
    set nombre_arrive = v_new_arrive, statut = v_statut, ne_viendra_pas = false
    where id = p_invitation_id
    returning * into v_inv;

  insert into checkins (event_id, invitation_id, agent_id, nombre_personnes, ancien_total, nouveau_total, is_correction)
    values (v_inv.event_id, p_invitation_id, p_agent_id, 1, v_inv.nombre_arrive - 1, v_inv.nombre_arrive, false);

  insert into audit_logs (event_id, action, invitation_id, table_id, agent_id, details)
    values (
      v_inv.event_id, 'unplanned_arrival', p_invitation_id, v_inv.table_id, p_agent_id,
      jsonb_build_object('guest_id', v_guest_id, 'nom_affichage', coalesce(v_affichage, 'Invité sans nom'))
    );

  return v_inv;
end;
$$ language plpgsql set search_path = public, pg_temp;

create or replace function set_guest_arrival_status(
  p_guest_id uuid,
  p_agent_id uuid,
  p_status text
) returns invitations as $$
declare
  v_invitation_id uuid;
  v_old_status text;
  v_guest_nom text;
  v_is_unplanned boolean;
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

  select arrival_status, nom_affichage, is_unplanned into v_old_status, v_guest_nom, v_is_unplanned
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

  -- Un guest is_unplanned (ajoute via "+" -> add_unplanned_arrival) n'a
  -- JAMAIS ete compte dans nombre_prevu a sa creation : ses allers-retours
  -- attendu/arrive/ne_viendra_pas ne doivent donc jamais y toucher, quel
  -- que soit l'etat -- seul nombre_arrive bouge pour lui.
  if not v_is_unplanned then
    if v_old_status = 'ne_viendra_pas' then v_prevu_delta := v_prevu_delta + 1; end if;
    if p_status = 'ne_viendra_pas' then v_prevu_delta := v_prevu_delta - 1; end if;
  end if;
  if v_old_status = 'arrive' then v_arrive_delta := v_arrive_delta - 1; end if;
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

create or replace function remove_invitation_member(
  p_guest_id uuid,
  p_agent_id uuid
) returns invitations as $$
declare
  v_invitation_id uuid;
  v_inv invitations;
  v_guest_nom_affichage text;
  v_guest_status text;
  v_is_unplanned boolean;
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

  select nom_affichage, arrival_status, is_unplanned into v_guest_nom_affichage, v_guest_status, v_is_unplanned
    from guests where id = p_guest_id;

  delete from invitation_guests where guest_id = p_guest_id;
  delete from guests where id = p_guest_id;

  v_new_prevu := case
    when v_is_unplanned then v_inv.nombre_prevu
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

create or replace function split_guest_to_new_invitation(
  p_guest_id uuid,
  p_table_id uuid,
  p_agent_id uuid
) returns invitations as $$
declare
  v_source_invitation_id uuid;
  v_source invitations;
  v_table tables;
  v_guest_nom_affichage text;
  v_guest_status text;
  v_is_unplanned boolean;
  v_new_prevu int;
  v_new_arrive int;
  v_statut text;
  v_new_inv invitations;
begin
  select invitation_id into v_source_invitation_id from invitation_guests where guest_id = p_guest_id;
  if v_source_invitation_id is null then
    raise exception 'member_not_found';
  end if;

  select * into v_source from invitations where id = v_source_invitation_id for update;
  if not found then
    raise exception 'invitation_not_found';
  end if;

  select * into v_table from tables where id = p_table_id for update;
  if not found then
    raise exception 'table_not_found';
  end if;

  select nom_affichage, arrival_status, is_unplanned into v_guest_nom_affichage, v_guest_status, v_is_unplanned
    from guests where id = p_guest_id for update;
  if not found then
    raise exception 'guest_not_found';
  end if;

  -- 1. Retire la personne de la source (meme comptabilite que
  --    remove_invitation_member, voir 0029/0048) : un guest is_unplanned ne
  --    doit jamais redecrementer nombre_prevu, il n'y a jamais ete compte.
  v_new_prevu := case
    when v_is_unplanned then v_source.nombre_prevu
    when v_guest_status = 'ne_viendra_pas' then v_source.nombre_prevu
    else greatest(v_source.nombre_prevu - 1, 0)
  end;
  v_new_arrive := case
    when v_guest_status = 'arrive' then greatest(v_source.nombre_arrive - 1, 0)
    else v_source.nombre_arrive
  end;
  v_statut := case
    when v_new_arrive = 0 then 'non_arrive'
    when v_new_arrive < v_new_prevu then 'partiel'
    when v_new_arrive = v_new_prevu then 'complet'
    else 'excedent'
  end;

  update invitations set nombre_prevu = v_new_prevu, nombre_arrive = v_new_arrive, statut = v_statut
    where id = v_source_invitation_id;

  -- 2. Cree la nouvelle invitation (une personne) a la table choisie.
  --    arrival_status du guest reste tel quel : on ne fait que le
  --    reparenter, pas changer son etat d'arrivee. Un guest is_unplanned
  --    reste "0 prevue" a sa nouvelle fiche aussi -- sinon le deplacer le
  --    ferait silencieusement compter dans les effectifs prevus, ce qu'il
  --    n'a jamais ete.
  insert into invitations (
    event_id, table_id, nom_affichage, nombre_prevu, nombre_arrive, statut,
    category, cote
  ) values (
    v_source.event_id, p_table_id, v_guest_nom_affichage,
    case when v_is_unplanned then 0 else 1 end,
    case when v_guest_status = 'arrive' then 1 else 0 end,
    case
      when v_guest_status = 'arrive' and v_is_unplanned then 'excedent'
      when v_guest_status = 'arrive' then 'complet'
      when v_guest_status = 'ne_viendra_pas' then 'non_arrive'
      else 'non_arrive'
    end,
    v_source.category, v_source.cote
  ) returning * into v_new_inv;

  update invitation_guests set invitation_id = v_new_inv.id where guest_id = p_guest_id;

  insert into audit_logs (event_id, action, invitation_id, table_id, agent_id, details)
    values (
      v_source.event_id, 'guest_split_move', v_source_invitation_id, v_source.table_id, p_agent_id,
      jsonb_build_object(
        'guest_id', p_guest_id, 'nom_affichage', v_guest_nom_affichage,
        'nouvelle_invitation_id', v_new_inv.id, 'nouvelle_table_id', p_table_id,
        'nouvelle_table_number', v_table.number
      )
    );

  return v_new_inv;
end;
$$ language plpgsql set search_path = public, pg_temp;
