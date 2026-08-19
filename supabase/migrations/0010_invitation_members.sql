-- ============================================================================
-- Gestion des membres individuels d'une invitation (ex: retirer "Marie" d'un
-- groupe de 4 sans toucher aux 3 autres, ou nommer une personne qui n'a pas
-- encore de prenom/nom connu). Utilise les tables guests + invitation_guests
-- (deja presentes dans le schema, deja lisibles cote client via RLS depuis
-- 0003_rls.sql, mais pas encore utilisees par l'application).
--
-- Toutes les fonctions verrouillent la ligne "invitations" correspondante en
-- premier (SELECT ... FOR UPDATE) : ca serialise toutes les modifications de
-- la liste de membres d'un meme groupe entre agents simultanes, exactement
-- comme record_checkin / move_invitation_table le font deja pour le reste.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- initialize_invitation_members : transforme la liste "Membres: ..." (texte
-- libre importe) en lignes structurees, une seule fois par invitation. Si
-- deja initialisee, echoue proprement (l'ecran recharge alors la liste
-- existante au lieu d'ecraser un travail deja fait par un autre agent).
-- Ne modifie PAS nombre_prevu : c'est un simple passage du texte vers des
-- lignes editables, pas un recomptage.
-- ----------------------------------------------------------------------------
create or replace function initialize_invitation_members(
  p_invitation_id uuid,
  p_members jsonb, -- tableau de {"prenom": text|null, "nom": text|null}
  p_agent_id uuid
) returns invitations as $$
declare
  v_inv invitations;
  v_existing int;
  v_member jsonb;
  v_prenom text;
  v_nom text;
  v_affichage text;
  v_guest_id uuid;
begin
  select * into v_inv from invitations where id = p_invitation_id for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  select count(*) into v_existing from invitation_guests where invitation_id = p_invitation_id;
  if v_existing > 0 then
    raise exception 'already_initialized';
  end if;

  for v_member in select * from jsonb_array_elements(coalesce(p_members, '[]'::jsonb))
  loop
    v_prenom := nullif(trim(both from coalesce(v_member->>'prenom', '')), '');
    v_nom := nullif(trim(both from coalesce(v_member->>'nom', '')), '');
    v_affichage := nullif(trim(both from (coalesce(v_prenom, '') || ' ' || coalesce(v_nom, ''))), '');

    insert into guests (event_id, nom, prenom, nom_affichage)
      values (v_inv.event_id, v_nom, v_prenom, coalesce(v_affichage, 'Invite sans nom'))
      returning id into v_guest_id;

    insert into invitation_guests (invitation_id, guest_id) values (p_invitation_id, v_guest_id);
  end loop;

  insert into audit_logs (event_id, action, invitation_id, table_id, agent_id, details)
    values (
      v_inv.event_id, 'members_initialize', p_invitation_id, v_inv.table_id, p_agent_id,
      jsonb_build_object(
        'nom_affichage', v_inv.nom_affichage,
        'nombre_membres', jsonb_array_length(coalesce(p_members, '[]'::jsonb))
      )
    );

  return v_inv;
end;
$$ language plpgsql set search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- add_invitation_member : ajoute une personne au groupe (nom/prenom
-- optionnels -- "sans nom" est autorise, modifiable plus tard). Augmente
-- nombre_prevu de 1 et recalcule le statut.
-- ----------------------------------------------------------------------------
create or replace function add_invitation_member(
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
  v_new_prevu int;
  v_statut text;
begin
  select * into v_inv from invitations where id = p_invitation_id for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  v_prenom := nullif(trim(both from coalesce(p_prenom, '')), '');
  v_nom := nullif(trim(both from coalesce(p_nom, '')), '');
  v_affichage := nullif(trim(both from (coalesce(v_prenom, '') || ' ' || coalesce(v_nom, ''))), '');

  insert into guests (event_id, nom, prenom, nom_affichage)
    values (v_inv.event_id, v_nom, v_prenom, coalesce(v_affichage, 'Invite sans nom'))
    returning id into v_guest_id;

  insert into invitation_guests (invitation_id, guest_id) values (p_invitation_id, v_guest_id);

  v_new_prevu := v_inv.nombre_prevu + 1;

  if v_inv.nombre_arrive = 0 then
    v_statut := 'non_arrive';
  elsif v_inv.nombre_arrive < v_new_prevu then
    v_statut := 'partiel';
  elsif v_inv.nombre_arrive = v_new_prevu then
    v_statut := 'complet';
  else
    v_statut := 'excedent';
  end if;

  update invitations set nombre_prevu = v_new_prevu, statut = v_statut
    where id = p_invitation_id
    returning * into v_inv;

  insert into audit_logs (event_id, action, invitation_id, table_id, agent_id, details)
    values (
      v_inv.event_id, 'member_add', p_invitation_id, v_inv.table_id, p_agent_id,
      jsonb_build_object('guest_id', v_guest_id, 'nom_affichage', coalesce(v_affichage, 'Invite sans nom'))
    );

  return v_inv;
end;
$$ language plpgsql set search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- remove_invitation_member : retire UNE personne precise du groupe (identifiee
-- par son guest_id), sans toucher aux autres. Diminue nombre_prevu de 1
-- (jamais sous 0) et recalcule le statut.
-- ----------------------------------------------------------------------------
create or replace function remove_invitation_member(
  p_guest_id uuid,
  p_agent_id uuid
) returns invitations as $$
declare
  v_invitation_id uuid;
  v_inv invitations;
  v_guest_nom_affichage text;
  v_new_prevu int;
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

  select nom_affichage into v_guest_nom_affichage from guests where id = p_guest_id;

  delete from invitation_guests where guest_id = p_guest_id;
  delete from guests where id = p_guest_id;

  v_new_prevu := greatest(v_inv.nombre_prevu - 1, 0);

  if v_inv.nombre_arrive = 0 then
    v_statut := 'non_arrive';
  elsif v_inv.nombre_arrive < v_new_prevu then
    v_statut := 'partiel';
  elsif v_inv.nombre_arrive = v_new_prevu then
    v_statut := 'complet';
  else
    v_statut := 'excedent';
  end if;

  update invitations set nombre_prevu = v_new_prevu, statut = v_statut
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

-- ----------------------------------------------------------------------------
-- rename_invitation_member : modifie le prenom/nom d'une personne du groupe
-- (permet de nommer une personne "sans nom", ou corriger une erreur). Ne
-- touche pas nombre_prevu.
-- ----------------------------------------------------------------------------
create or replace function rename_invitation_member(
  p_guest_id uuid,
  p_prenom text,
  p_nom text,
  p_agent_id uuid
) returns guests as $$
declare
  v_invitation_id uuid;
  v_inv invitations;
  v_guest guests;
  v_prenom text;
  v_nom text;
  v_affichage text;
begin
  select invitation_id into v_invitation_id from invitation_guests where guest_id = p_guest_id;

  if v_invitation_id is null then
    raise exception 'member_not_found';
  end if;

  -- Verrouille la ligne invitation parente pour serialiser avec les autres
  -- operations (add/remove/rename) sur le meme groupe.
  select * into v_inv from invitations where id = v_invitation_id for update;

  v_prenom := nullif(trim(both from coalesce(p_prenom, '')), '');
  v_nom := nullif(trim(both from coalesce(p_nom, '')), '');
  v_affichage := nullif(trim(both from (coalesce(v_prenom, '') || ' ' || coalesce(v_nom, ''))), '');

  update guests
    set prenom = v_prenom, nom = v_nom, nom_affichage = coalesce(v_affichage, 'Invite sans nom')
    where id = p_guest_id
    returning * into v_guest;

  insert into audit_logs (event_id, action, invitation_id, table_id, agent_id, details)
    values (
      v_inv.event_id, 'member_rename', v_invitation_id, v_inv.table_id, p_agent_id,
      jsonb_build_object('guest_id', p_guest_id, 'nom_affichage', v_guest.nom_affichage)
    );

  return v_guest;
end;
$$ language plpgsql set search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- Realtime : permet aux ecrans "membres" ouverts par plusieurs agents en
-- meme temps de se mettre a jour automatiquement.
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table guests;
alter publication supabase_realtime add table invitation_guests;
