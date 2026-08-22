-- ============================================================================
-- rename_invitation : corrige le nom affiche d'une invitation (ex: un
-- "Accompagnant non-nomme" identifie par la suite -- l'assistant d'un
-- photographe, par exemple). Ne touche a rien d'autre (nombre_prevu,
-- nombre_arrive, table, tags) : c'est une correction de nom, pas un
-- recomptage. Meme convention que rename_guest (0010_invitation_members.sql)
-- pour les membres detailles, mais au niveau de l'invitation elle-meme.
--
-- merge_invitations : fusionne une invitation "source" dans une invitation
-- "cible" (ex: regrouper un accompagnant isole avec le groupe auquel il
-- appartient vraiment). Additionne nombre_prevu/nombre_arrive/
-- nombre_supplementaire, reattache TOUT ce qui referme la source
-- (checkins, overflow_assignments, invitation_guests, exceptions,
-- audit_logs) vers la cible avant de supprimer la source -- rien n'est
-- perdu, contrairement a une simple suppression qui ferait disparaitre
-- l'historique de checkins/debordements en cascade.
--
-- Attention (rappelee cote UI, pas bloquee ici) : fusionner deux
-- invitations `category = 'Staff'` regroupe leur arrivee en une seule
-- case a cocher, ce qui va a l'encontre de la regle d'individuation du
-- staff (docs/BUSINESS_RULES.md). C'est parfois voulu (corriger un import
-- qui avait a tort separe deux membres d'un meme foyer non-staff), donc pas
-- bloque -- juste averti, meme philosophie que le deplacement de table
-- (avertissement de capacite, jamais de blocage).
-- ============================================================================

create or replace function rename_invitation(
  p_invitation_id uuid,
  p_nouveau_nom text,
  p_agent_id uuid
) returns invitations as $$
declare
  v_inv invitations;
  v_ancien_nom text;
begin
  select * into v_inv from invitations where id = p_invitation_id for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  if p_nouveau_nom is null or btrim(p_nouveau_nom) = '' then
    raise exception 'nom_requis';
  end if;

  v_ancien_nom := v_inv.nom_affichage;

  update invitations
    set nom_affichage = btrim(p_nouveau_nom)
    where id = p_invitation_id
    returning * into v_inv;

  insert into audit_logs (
    event_id, action, invitation_id, table_id, agent_id, details
  ) values (
    v_inv.event_id, 'invitation_rename', p_invitation_id, v_inv.table_id, p_agent_id,
    jsonb_build_object('ancien_nom', v_ancien_nom, 'nouveau_nom', v_inv.nom_affichage)
  );

  return v_inv;
end;
$$ language plpgsql set search_path = public, pg_temp;

create or replace function merge_invitations(
  p_source_invitation_id uuid,
  p_target_invitation_id uuid,
  p_agent_id uuid
) returns invitations as $$
declare
  v_source invitations;
  v_target invitations;
begin
  if p_source_invitation_id = p_target_invitation_id then
    raise exception 'same_invitation';
  end if;

  -- Verrouille les deux lignes dans un ordre stable (par id) pour eviter un
  -- deadlock si deux fusions opposees sont tentees en meme temps.
  if p_source_invitation_id < p_target_invitation_id then
    select * into v_source from invitations where id = p_source_invitation_id for update;
    select * into v_target from invitations where id = p_target_invitation_id for update;
  else
    select * into v_target from invitations where id = p_target_invitation_id for update;
    select * into v_source from invitations where id = p_source_invitation_id for update;
  end if;

  if v_source.id is null then
    raise exception 'source_not_found';
  end if;
  if v_target.id is null then
    raise exception 'target_not_found';
  end if;
  if v_source.event_id <> v_target.event_id then
    raise exception 'different_event';
  end if;

  -- Reattache l'historique de la source vers la cible AVANT de la supprimer.
  update checkins set invitation_id = p_target_invitation_id where invitation_id = p_source_invitation_id;
  update overflow_assignments set invitation_id = p_target_invitation_id where invitation_id = p_source_invitation_id;
  update invitation_guests set invitation_id = p_target_invitation_id where invitation_id = p_source_invitation_id;
  update exceptions set invitation_id = p_target_invitation_id where invitation_id = p_source_invitation_id;
  update audit_logs set invitation_id = p_target_invitation_id where invitation_id = p_source_invitation_id;

  update invitations
    set nombre_prevu = v_target.nombre_prevu + v_source.nombre_prevu,
        nombre_arrive = v_target.nombre_arrive + v_source.nombre_arrive,
        nombre_supplementaire = v_target.nombre_supplementaire + v_source.nombre_supplementaire,
        statut = case
          when v_target.nombre_arrive + v_source.nombre_arrive <= 0 then 'non_arrive'
          when v_target.nombre_arrive + v_source.nombre_arrive < v_target.nombre_prevu + v_source.nombre_prevu then 'partiel'
          when v_target.nombre_arrive + v_source.nombre_arrive = v_target.nombre_prevu + v_source.nombre_prevu then 'complet'
          else 'excedent'
        end
    where id = p_target_invitation_id
    returning * into v_target;

  delete from invitations where id = p_source_invitation_id;

  insert into audit_logs (
    event_id, action, invitation_id, table_id, agent_id, details
  ) values (
    v_target.event_id, 'invitation_merge', p_target_invitation_id, v_target.table_id, p_agent_id,
    jsonb_build_object(
      'nom_affichage', v_target.nom_affichage,
      'source_nom_affichage', v_source.nom_affichage,
      'source_invitation_id', p_source_invitation_id,
      'source_nombre_prevu', v_source.nombre_prevu,
      'source_nombre_arrive', v_source.nombre_arrive
    )
  );

  return v_target;
end;
$$ language plpgsql set search_path = public, pg_temp;
