-- ============================================================================
-- v1.82.1 (11/10/2026) -- demande de Gersom : remplacer l'agenda du jour J par
-- le programme complet du 24/10/2026 (equipe d'accueil, DJ, directeur du
-- festin). 47 activites ; chacune porte un departement, des responsables en
-- noms libres (custom_assignees, a lier plus tard a de vrais comptes) et une
-- visibilite : is_private = false pour ce dont l'accueil a besoin (texte
-- neutre, rien sur la destination des maries), true pour les coulisses et la
-- surprise (admin/directeur seulement, filtre cote serveur par GET /api/agenda).
--
-- REMPLACE les activites actuelles de chaque evenement qui en a. Sauvegarde :
-- import_backups (snapshot->>'kind' = 'v1.82.1_agenda_jour_j') AVANT toute
-- ecriture. Retour arriere : reinserer snapshot->'agenda_items'.
-- Idempotente : rejouee, elle ne fait rien (detecte la ligne
-- « Préparation de l'accueil »). Contient un DELETE : a executer par Gersom
-- dans l'editeur SQL Supabase (voir docs/MIGRATIONS_PRODUCTION.md).
-- ============================================================================

do $$
declare
  v_event record;
begin
  for v_event in
    select distinct ai.event_id from agenda_items ai
    where not exists (
      select 1 from agenda_items x
      where x.event_id = ai.event_id and x.title = 'Préparation de l''accueil'
    )
  loop
    insert into import_backups (event_id, agent_id, snapshot, invitations_count)
    select v_event.event_id, null, jsonb_build_object(
      'kind', 'v1.82.1_agenda_jour_j',
      'agenda_items', (select jsonb_agg(to_jsonb(a)) from agenda_items a where a.event_id = v_event.event_id)
    ), (select count(*) from invitations where event_id = v_event.event_id);

    delete from agenda_items where event_id = v_event.event_id;

    insert into agenda_items (event_id, time_label, title, department, details, sort_order, custom_assignees, is_private)
    select v_event.event_id, s.time_label, s.title, s.department, s.details, s.sort_order, s.custom_assignees, s.is_private
    from (values
    ('06:00', 'Maquillage de la mariée et des femmes d''honneur', 'Préparation', null, 10, array['Directeur du festin']::text[], true),
    ('09:00', 'Décorateurs au Festif', 'Décoration', 'Tables, chaises, nappes, fleurs, centres de table, arche et décoration générale.', 20, array['Décorateurs']::text[], true),
    ('10:00', 'Arrivée du traiteur', 'Restauration', 'Vin d''honneur, cocktails, entrées, plat principal, desserts, bar et champagne.', 30, array['Traiteur']::text[], true),
    ('10:00', 'Vidéaste principal à l''hôtel du marié', 'Média', 'Préparatifs.', 40, array['Vidéaste principal']::text[], true),
    ('11:30', 'Photographe et vidéaste secondaire au Festif', 'Média', 'Salle décorée, détails, préparatifs et coulisses.', 50, array['Photographe', 'vidéaste secondaire']::text[], true),
    ('12:00', 'Départ vers Château Jeanne & The Forest', 'Transport', 'Mariés, famille de Gégé, proches, témoins, équipe photo/vidéo.', 60, array['Directeur du festin']::text[], true),
    ('12:30–13:30', 'Séance photo au château', 'Média', 'Couple, familles, témoins, jardins, devant le château. Drone si autorisé.', 70, array['Photographe']::text[], true),
    ('13:00–14:00', 'Arrivée du DJ et installation sono de la cérémonie', 'Technique', 'Deux enceintes, table de mixage, micros pour le discours de mariage.', 80, array['DJ']::text[], true),
    ('13:30', 'Premier départ du château vers le Festif', 'Transport', 'Groupe prioritaire. Rotation de 30 min aller-retour.', 90, array['Directeur du festin']::text[], true),
    ('14:00', 'Retour du véhicule, départ du 2e et dernier groupe', 'Transport', null, 100, array['Directeur du festin']::text[], true),
    ('14:00–14:30', 'Tests sonores et vérifications finales', 'Technique', 'Micros, volumes, connexions. Sono prête avant l''arrivée des mariés.', 110, array['DJ', 'Dan Elenga']::text[], true),
    ('Avant 14:30', 'Préparation de l''accueil', 'Accueil', 'Préparer la liste des invités, le contrôle des codes QR et le plan des tables. Repérer la zone cérémonie, le chapiteau et la salle principale. Consigne essentielle : vérifier les invitations, orienter les invités, signaler toute difficulté au directeur du festin. Ne pas révéler la destination des mariés ni les détails de la surprise.', 120, array['Équipe d''accueil']::text[], false),
    ('14:30', 'Arrivée des mariés', 'Accueil', 'Faciliter leur passage et orienter les invités vers la cérémonie.', 130, array['Équipe d''accueil']::text[], false),
    ('14:30', 'Visite de la salle et dernières modifications (mariés)', 'Coordination', null, 140, array['Directeur du festin']::text[], true),
    ('14:30–15:40', 'Installation du matériel du DJ dans la salle principale', 'Technique', 'Travaux silencieux pendant la cérémonie.', 150, array['DJ']::text[], true),
    ('15:00–15:45', 'Cérémonie religieuse', 'Cérémonie', 'Accueillir discrètement les retardataires et limiter les déplacements.', 160, array['Équipe d''accueil']::text[], false),
    ('15:00–15:45', 'Son et micros de la cérémonie', 'Technique', 'Dan Elenga gère le son pendant que le DJ continue l''installation.', 170, array['Dan Elenga']::text[], true),
    ('15:45–15:55', 'Champagne et bouchées pour les mariés', 'Restauration', 'Prévoir une portion à emporter si nécessaire.', 180, array['Traiteur']::text[], true),
    ('15:55', 'Départ discret des mariés', 'Coordination', 'Dégager leur passage par le chapiteau. Les mariés doivent avoir quitté les lieux avant 16h00. Préserver la surprise.', 190, array['Équipe d''accueil']::text[], false),
    ('15:55', 'Départ vers l''aérodrome de Persan', 'Coordination', 'Départ impératif avant 16h00. Destination confidentielle.', 200, array['Directeur du festin']::text[], true),
    ('16:00', 'Vin d''honneur', 'Restauration', 'Orienter les invités vers le cocktail et le chapiteau.', 210, array['Équipe d''accueil', 'Traiteur']::text[], false),
    ('16:00–16:35', 'Transfert sono vers le chapiteau et test micro', 'Technique', 'Deux enceintes + table de mixage. 16h30–16h35 : micro et bandes instrumentales de Laura Humba.', 220, array['DJ']::text[], true),
    ('16:00–17:30', 'Arrivée des prestataires média et zone média', 'Média', 'Transformation de la zone cérémonie en zone média.', 230, array['Équipe média']::text[], true),
    ('16:35–17:40', 'Prestation de Laura Humba (chapiteau)', 'Animation', 'Deux sets de 30 min avec une courte pause. Accompagner les déplacements des invités dans le chapiteau.', 240, array['Laura Humba', 'DJ']::text[], false),
    ('17:10', 'Rassemblement des invités VIP', 'Accueil', '100 invités au stationnement avec le mégaphone. Vérifier la liste, sans révéler les détails de la surprise.', 250, array['Équipe d''accueil']::text[], false),
    ('17:15–17:25', 'Embarquement des VIP', 'Transport', 'Bus à 17h15. Fin de l''embarquement et départ à 17h25. Vérifier les effectifs avec le responsable du transport.', 260, array['Équipe d''accueil', 'responsable transport']::text[], false),
    ('17:25–17:55', 'Convoi VIP et accueil de la mariée à l''aérodrome', 'Coordination', '17h35 arrivée des VIP · 17h45 VIP en place · 17h55 atterrissage de l''hélicoptère.', 270, array['Directeur du festin']::text[], true),
    ('17:40', 'Diffusion en direct depuis l''aérodrome', 'Média', 'Coordonner le son du direct avec l''équipe vidéo.', 280, array['DJ', 'équipe vidéo']::text[], true),
    ('18:00', 'Ouverture de la salle principale', 'Accueil', 'Orienter les invités vers leurs tables. Musique d''accueil.', 290, array['Équipe d''accueil']::text[], false),
    ('18:05', 'Départ des autobus vers le Festif', 'Transport', null, 300, array['Responsable transport']::text[], true),
    ('18:15–18:30', 'Retour des invités VIP', 'Accueil', 'Accueillir les autobus. Diriger les VIP d''abord vers le chapiteau, puis vers la salle principale sur consigne du directeur du festin.', 310, array['Équipe d''accueil']::text[], false),
    ('18:30–19:00', 'Discours et animations', 'Animation', 'Jeux courts, anecdotes, messages des invités. Aucune vidéo souvenir. Faciliter l''installation et garder les passages dégagés.', 320, array['Directeur du festin', 'DJ']::text[], false),
    ('19:15–19:35', 'Entrées des mariés', 'Animation', 'Marié et son groupe, puis mariée et son groupe. Dégager le passage. Musique lancée sur signal du directeur du festin.', 330, array['Équipe d''accueil', 'DJ']::text[], false),
    ('19:50', 'Prière, annonces et lancement du repas', 'Animation', 'Limiter les déplacements. Musique coupée pendant la prière.', 340, array['Directeur du festin']::text[], false),
    ('20:00', 'Ouverture du buffet', 'Restauration', 'Orienter selon les consignes du service. Buffet ouvert à toutes les tables ; desserts déjà disponibles.', 350, array['Équipe d''accueil', 'Traiteur']::text[], false),
    ('20:00', 'Visite de la zone média et du buffet A par les mariés', 'Coordination', null, 360, array['Directeur du festin']::text[], true),
    ('20:15', 'Ouverture de la zone média', 'Média', 'Indiquer son emplacement aux invités.', 370, array['Équipe média', 'Équipe d''accueil']::text[], false),
    ('20:45–21:30', 'Chansons du repas', 'Animation', 'Coordonner les passages musicaux et les prestations.', 380, array['DJ']::text[], false),
    ('21:20', 'Danses traditionnelles et orchestre', 'Animation', 'En coordination avec les chansons du repas.', 390, array['DJ']::text[], false),
    ('21:30', 'Danses avec les parents', 'Animation', 'Papa David–Nelly : chant par Amy Eliano. Maman Gaby–Gersom : chant par Laura Humba.', 400, array['Amy Eliano', 'Laura Humba']::text[], false),
    ('22:00', 'Première danse des mariés et ouverture du bal', 'Animation', null, 410, array['DJ']::text[], false),
    ('22:00', 'Arrivée de Laly Cakes (gâteau pour 00h40)', 'Restauration', 'Réception et installation du gâteau.', 420, array['Laly Cakes']::text[], true),
    ('23:30', 'Session de sebene avec AngoStars', 'Animation', null, 430, array['AngoStars']::text[], false),
    ('23:40–00:40', 'Changement de tenue de la mariée', 'Coordination', 'Maintenir l''ambiance pendant le changement de tenue.', 440, array['DJ']::text[], false),
    ('00:40', 'Deuxième entrée des mariés, gâteau et champagne', 'Animation', 'Dégager le passage pour l''entrée, le gâteau et le champagne, puis reprise du bal.', 450, array['Équipe d''accueil', 'DJ', 'Laly Cakes']::text[], false),
    ('03:00', 'Fermeture du bar', 'Restauration', 'Début du nettoyage.', 460, array['Traiteur']::text[], false),
    ('05:00', 'Fin de la soirée', 'Coordination', 'Accompagner les derniers départs. Arrêt de la musique.', 470, array['Équipe d''accueil']::text[], false)
    ) as s(time_label, title, department, details, sort_order, custom_assignees, is_private);
  end loop;
end $$;
