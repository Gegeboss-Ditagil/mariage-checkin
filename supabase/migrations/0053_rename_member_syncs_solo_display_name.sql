-- ============================================================================
-- rename_invitation_member : pour une invitation SOLO (un seul membre dans
-- guests/invitation_guests), le nom affiche de l'invitation elle-meme
-- (invitations.nom_affichage, affiche dans le TopBar de /checkin/[id] et
-- partout ailleurs dans l'app) etait fige au nom importe au depart -- une
-- correction de nom via "Qui est arrive ?" (GuestArrivalPanel) ne mettait a
-- jour QUE la ligne guests, jamais le nom du haut. Retour de Gersom
-- (14/09/2026, capture d'ecran) : "le nom de l'invitation aussi en haut doit
-- suivre la correction". Pour un groupe (plusieurs membres), nom_affichage
-- reste le libelle du groupe (ex. "Famille X") -- inchange, jamais ecrase
-- par le nom d'un seul membre.
-- ============================================================================
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
  v_member_count int;
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

  select count(*) into v_member_count from invitation_guests where invitation_id = v_invitation_id;

  -- Invitation solo (un seul membre) : le nom du haut EST cette personne --
  -- on le fait suivre. Un groupe garde son libelle propre (ex. "Famille
  -- X"), jamais ecrase par le nom d'un seul de ses membres.
  if v_member_count = 1 then
    update invitations set nom_affichage = v_guest.nom_affichage where id = v_invitation_id;
  end if;

  insert into audit_logs (event_id, action, invitation_id, table_id, agent_id, details)
    values (
      v_inv.event_id, 'member_rename', v_invitation_id, v_inv.table_id, p_agent_id,
      jsonb_build_object(
        'guest_id', p_guest_id, 'nom_affichage', v_guest.nom_affichage,
        'invitation_nom_affichage_synced', v_member_count = 1
      )
    );

  return v_guest;
end;
$$ language plpgsql set search_path = public, pg_temp;
