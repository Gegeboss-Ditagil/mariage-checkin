-- ============================================================================
-- Deplacer UNE personne nommee vers une autre table, separement du reste de
-- son groupe. Demande de Gersom le 30/08/2026, apres l'arrivee par personne
-- (v1.21.0) et l'ajout/renommage direct (v1.23.0) : "ça va faciliter le
-- transfert de personnes d'une table à une autre parce que maintenant on
-- aura leurs noms".
--
-- Design : split + move plutot qu'un "deplacement partiel" ad hoc.
--   1. La personne est detachee de son invitation source (meme comptabilite
--      que remove_invitation_member sur la source : ne redecompte pas
--      nombre_prevu si deja 'ne_viendra_pas', sort nombre_arrive si 'arrive').
--   2. Une NOUVELLE invitation d'une seule personne est creee a la table
--      choisie (nombre_prevu=1, nombre_arrive selon l'etat actuel du guest,
--      arrival_status du guest INCHANGE -- on ne fait que le reparenter).
-- Si l'agent veut ensuite regrouper cette personne avec une invitation deja
-- presente a la table cible, la fonctionnalite "Fusionner avec un autre
-- groupe" existante (merge_invitations, 0021) fait le reste -- pas de
-- nouvelle logique de fusion a ecrire ici.
--
-- Ne copie PAS les tags/telephone/email de la source vers la nouvelle
-- invitation (specifiques au foyer, pas a cette personne) ; copie cote et
-- category (attributs personnels qui doivent suivre la personne, notamment
-- pour la regle d'individuation du staff).
-- ============================================================================

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

  select nom_affichage, arrival_status into v_guest_nom_affichage, v_guest_status
    from guests where id = p_guest_id for update;
  if not found then
    raise exception 'guest_not_found';
  end if;

  -- 1. Retire la personne de la source (meme comptabilite que
  --    remove_invitation_member, voir 0029_guest_arrival_status.sql).
  v_new_prevu := case
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
  --    reparenter, pas changer son etat d'arrivee.
  insert into invitations (
    event_id, table_id, nom_affichage, nombre_prevu, nombre_arrive, statut,
    category, cote
  ) values (
    v_source.event_id, p_table_id, v_guest_nom_affichage,
    1, case when v_guest_status = 'arrive' then 1 else 0 end,
    case
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
