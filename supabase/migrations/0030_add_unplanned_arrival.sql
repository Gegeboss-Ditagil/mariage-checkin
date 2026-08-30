-- ============================================================================
-- "+ Invité supplémentaire (non prévu)" devient un ajout NOMMÉ, pas un
-- simple compteur anonyme. Demande de Gersom le 30/08/2026 (avec deux
-- captures d'écran de "Famille David Lukau") : quelqu'un qui arrive sans
-- être prévu doit apparaître dans la liste "Qui est arrivé ?" comme tout le
-- monde (nom + ✓/✕), tout en gardant le declenchement de l'assignation de
-- table de reserve en cas de depassement de capacite, comme le faisait deja
-- le bouton anonyme.
--
-- Different de add_invitation_member (0010) : celle-ci augmente
-- nombre_prevu en meme temps qu'elle ajoute la personne -- ce qui ne cree
-- jamais de depassement, donc ne declenche jamais l'assignation de table.
-- add_unplanned_arrival() ci-dessous ne touche JAMAIS nombre_prevu : la
-- personne est ajoutee directement en 'arrive' (nombre_arrive +1), ce qui
-- cree naturellement le depassement attendu si le groupe est deja au
-- complet -- meme mecanique que l'ancien bouton "+1" anonyme
-- (app/api/checkin/route.ts / record_checkin), juste nommee.
-- ============================================================================

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

  insert into guests (event_id, nom, prenom, nom_affichage, arrival_status)
    values (v_inv.event_id, v_nom, v_prenom, coalesce(v_affichage, 'Invité sans nom'), 'arrive')
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
