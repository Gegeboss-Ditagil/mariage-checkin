-- ============================================================================
-- v1.82.2 (11/10/2026) -- corrections de l'agenda du jour J (suite de 0077),
-- decidees une par une avec Gersom apres la revue des conflits d'horaires :
--  1. Depart des maries : autre sortie que le chapiteau (publique + privee).
--  2. Transfert sono pendant le vin d'honneur : horaires gardes, note au DJ.
--  3. Rassemblement VIP : Laura Humba annonce, puis le megaphone dirige dehors.
--  4. Discours a 18:30 gardes ; le debut des animations sert d'accueil.
--  5. Nouvelle ligne privee : retour des maries en voiture (~18:15).
--  6. Deux lignes publiques de transition (19:00 entrees, 19:35 priere).
--  7. Visite des maries a 20:00 : « avant l'ouverture » de la zone media.
--  8. Chansons du repas raccourcies a 20:45-21:20.
--  9. AngoStars 23:30-00:00 maximum, puis le DJ.
-- 10. Bar ferme a 03:00, invites jusqu'a 05:00, nettoyage en coulisses seulement.
-- 11. Nouvelle ligne publique : arrivee des invites 14:30-15:00.
-- Responsables : Remy et Tuzola (comptes) pour « Directeur du festin » ;
-- agents scan + placeurs actifs (comptes) pour « Equipe d'accueil ».
--
-- Aucun DELETE. Sauvegarde : import_backups (snapshot->>'kind' =
-- 'v1.82.2_agenda_corrections') AVANT toute ecriture. Retour arriere :
-- reinserer snapshot->'agenda_items' apres avoir vide l'agenda.
-- Idempotente : rejouee, elle ne fait rien (detecte « Arrivée des invités »).
-- ============================================================================

do $$
declare
  v_event record;
  v_directeurs uuid[];
  v_accueil uuid[];
begin
  for v_event in
    select distinct ai.event_id from agenda_items ai
    where ai.title = 'Préparation de l''accueil'
      and not exists (
        select 1 from agenda_items x
        where x.event_id = ai.event_id and x.title = 'Arrivée des invités'
      )
  loop
    insert into import_backups (event_id, agent_id, snapshot, invitations_count)
    select v_event.event_id, null, jsonb_build_object(
      'kind', 'v1.82.2_agenda_corrections',
      'agenda_items', (select jsonb_agg(to_jsonb(a)) from agenda_items a where a.event_id = v_event.event_id)
    ), (select count(*) from invitations where event_id = v_event.event_id);

    -- 1. Depart des maries
    update agenda_items set details = 'Dégager leur passage : les mariés partent par une autre sortie que le chapiteau, que les invités ne doivent pas croiser. Ils doivent avoir quitté les lieux avant 16h00. Préserver la surprise.'
      where event_id = v_event.event_id and title = 'Départ discret des mariés';
    update agenda_items set details = 'Départ impératif avant 16h00, par une autre sortie que le chapiteau. Destination confidentielle.'
      where event_id = v_event.event_id and title = 'Départ vers l''aérodrome de Persan';

    -- 2. Sono pendant le vin d'honneur
    update agenda_items set details = details || ' Attention : le vin d''honneur est en cours dans le chapiteau, travailler discrètement.'
      where event_id = v_event.event_id and title = 'Transfert sono vers le chapiteau et test micro';

    -- 3. Rassemblement et embarquement des VIP
    update agenda_items set details = 'Laura Humba annonce depuis la scène que les VIP doivent quitter ; le mégaphone dirige ensuite les gens dehors, vers le stationnement. Vérifier la liste (100 invités), sans révéler les détails de la surprise.'
      where event_id = v_event.event_id and title = 'Rassemblement des invités VIP';
    update agenda_items set details = details || ' Le mégaphone dirige les VIP dehors vers les bus.'
      where event_id = v_event.event_id and title = 'Embarquement des VIP';

    -- 4. Discours : debut des animations = accueil
    update agenda_items set details = 'Le début des animations sert d''accueil pendant que les invités (VIP compris) s''installent tranquillement. ' || details
      where event_id = v_event.event_id and title = 'Discours et animations';

    -- 7. Visite des maries avant l'ouverture de la zone media
    update agenda_items set details = 'Visite avant l''ouverture de la zone média (20h15).'
      where event_id = v_event.event_id and title = 'Visite de la zone média et du buffet A par les mariés';

    -- 8. Chansons du repas
    update agenda_items set time_label = '20:45–21:20'
      where event_id = v_event.event_id and title = 'Chansons du repas';

    -- 9. AngoStars puis DJ
    update agenda_items set time_label = '23:30–00:00', details = '30 minutes maximum, puis le DJ assure l''ambiance.'
      where event_id = v_event.event_id and title = 'Session de sebene avec AngoStars';
    update agenda_items set details = 'Maintenir l''ambiance pendant le changement de tenue : AngoStars jusqu''à 00h00, puis le DJ.'
      where event_id = v_event.event_id and title = 'Changement de tenue de la mariée';

    -- 10. Fermeture du bar
    update agenda_items set details = 'Le bar ferme ; les invités restent jusqu''à 05h00. Le nettoyage ne concerne que le traiteur et les coulisses.'
      where event_id = v_event.event_id and title = 'Fermeture du bar';

    -- 5, 6, 11. Nouvelles lignes
    insert into agenda_items (event_id, time_label, title, department, details, sort_order, custom_assignees, is_private)
    values
      (v_event.event_id, '14:30–15:00', 'Arrivée des invités', 'Accueil', 'Contrôle des codes QR et orientation vers la cérémonie. Les mariés arrivent aussi à 14h30 : faciliter leur passage.', 125, array['Équipe d''accueil']::text[], false),
      (v_event.event_id, '18:15', 'Retour des mariés au Festif', 'Coordination', 'Retour en voiture après l''atterrissage ; arrivée vers 18h15–18h30 par l''entrée réservée. Coulisses jusqu''à 19h15.', 305, array['Directeur du festin']::text[], true),
      (v_event.event_id, '19:00', 'Mise en place des entrées', 'Animation', 'Préparer le passage pour l''entrée du marié et de son groupe, puis de la mariée et de son groupe.', 325, array['Équipe d''accueil', 'DJ']::text[], false),
      (v_event.event_id, '19:35', 'Mise en place de la prière', 'Animation', 'Limiter les déplacements ; musique coupée pendant la prière.', 335, array['Directeur du festin', 'DJ']::text[], false);

    -- Responsables : vrais comptes (assignee_ids) a la place des noms libres
    select coalesce(array_agg(id), '{}') into v_directeurs from users
      where event_id = v_event.event_id and role = 'directeur' and active and nom_affichage in ('Rémy', 'Tuzola');
    select coalesce(array_agg(id), '{}') into v_accueil from users
      where event_id = v_event.event_id and role in ('agent_checkin', 'placeur') and active;

    update agenda_items
      set assignee_ids = v_directeurs, custom_assignees = array_remove(custom_assignees, 'Directeur du festin')
      where event_id = v_event.event_id and 'Directeur du festin' = any (custom_assignees) and cardinality(v_directeurs) > 0;
    update agenda_items
      set assignee_ids = v_accueil, custom_assignees = array_remove(custom_assignees, 'Équipe d''accueil')
      where event_id = v_event.event_id and 'Équipe d''accueil' = any (custom_assignees) and cardinality(v_accueil) > 0;
  end loop;
end $$;
