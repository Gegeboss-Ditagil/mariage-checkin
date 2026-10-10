-- ============================================================================
-- v1.75.0 -- prépare l'invitation de test des parcours de bout en bout
-- (e2e/first-use.spec.ts) : une invitation SANS table et SANS lignes
-- nominatives, comme 251 vraies invitations le jour J. À lancer dans l'éditeur
-- SQL Supabase AVANT chaque passage E2E ; le résultat affiche l'id à mettre
-- dans E2E_FRESH_INVITATION_ID. Sans table : jamais comptée au tableau de bord.
-- ============================================================================
do $$
declare
  v_event uuid;
  v_id uuid;
begin
  select id into v_event from events limit 1;
  select id into v_id from invitations where event_id = v_event and nom_affichage = 'ZZ Test E2E (ne pas pointer)';
  if v_id is null then
    insert into invitations (event_id, nom_affichage, nombre_prevu, nombre_arrive, statut, notes)
      values (v_event, 'ZZ Test E2E (ne pas pointer)', 2, 0, 'non_arrive',
              'Invitation de test des parcours E2E -- Membres: Test Premier, Test Second')
      returning id into v_id;
  end if;
  -- « Jamais ouverte » : on retire les lignes créées par le passage précédent.
  delete from guests g using invitation_guests ig
    where ig.guest_id = g.id and ig.invitation_id = v_id;
  update invitations set nombre_prevu = 2, nombre_arrive = 0, statut = 'non_arrive', table_id = null where id = v_id;
end $$;
select id as e2e_fresh_invitation_id from invitations where nom_affichage = 'ZZ Test E2E (ne pas pointer)';
