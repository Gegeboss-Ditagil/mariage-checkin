-- ============================================================================
-- v1.79.2 (11/10/2026) -- demande de Gersom : « met à jour, j'ai corrigé les
-- noms et invitations disparates » (guest-list_66.csv + plan seatplan.io du
-- 10/10/2026, export _3) + suppressions demandées : Ashnee Barclay, Famille
-- Mwinba, Lina Kumpesa (ne viendra pas), Grâce Ndonga, Sister 1 Malungu.
--
-- Seules les corrections où With Joy ET le plan sont d'accord sont appliquées :
--  - Lys Landu -> table 30, Roger Makongo -> table 41 (échange) ;
--  - « Famille Pierrefitte » -> « Famille Moussaoui » (Greg, Maeva, Julia) ;
--  - Allegria Mpilingi -> Solena Marzollo (Famille Landu, table 41) ;
--  - noms : Maman Mvovi, Tata Julie Indanda, Ya Lale Culumbu, Acacia Nzasi,
--    Famille Eliano (Roger (Ami Eliano) Culumbu, Artiste VIP Ango Stars,
--    Artiste Ango Stars), Raphael Opetum Isei Ngalula, Maman Domingos,
--    Kizomba Artist, Joeliane Elmacin Lumbu.
-- Non touché (With Joy et plan encore différents) : voir CHANGELOG 1.79.2.
--
-- Aucune de ces invitations n'a d'arrivée ; seules Lys Landu et Roger Makongo
-- ont des lignes nominatives (inchangées, seule la table bouge).
-- Sauvegarde : import_backups (snapshot->>'kind' = 'v1.79.2_sync_guest_list_66')
-- AVANT toute écriture. Retour arrière : réécrire nom_affichage, notes et
-- table_id depuis l'instantané, réinsérer les invitations supprimées.
-- Idempotente : rejouée, elle ne change plus rien.
-- ============================================================================

do $$
declare
  v_event uuid;
  v_t30 uuid;
  v_t41 uuid;
begin
  select id into v_event from events limit 1;
  select id into v_t30 from tables where event_id = v_event and number = 30;
  select id into v_t41 from tables where event_id = v_event and number = 41;

  drop table if exists tmp_sync_ids, tmp_sync_remove, tmp_sync_remove_guests;
  create temporary table tmp_sync_ids (id uuid primary key) on commit drop;
  insert into tmp_sync_ids values
    ('4c598c1e-e165-419e-8409-6168c265449f'), -- Famille Mvovi
    ('80566d47-c7d5-4846-b3a7-367656677b2b'), -- Famille Culumbu (table 8)
    ('008558db-41aa-4934-bc2f-ed8903d09d30'), -- Lale Culumbu
    ('c74a9163-d790-4d16-b29a-76496e688f68'), -- Famille Nzasi
    ('56c5e24a-e07f-4813-a210-1822b515f5d8'), -- Roger (Amy Eliano) Culumbu
    ('526628b0-a410-4f3c-bf42-c424e6a68775'), -- Rafael Opetum Isei
    ('99f91736-f559-4c5b-a77c-41478645dea4'), -- Roger Makongo
    ('16310b94-9c93-4e98-81a8-b9931cbbf72b'), -- Lys Landu
    ('900b66bd-f60d-49d9-8d05-1b676d304764'), -- Famille Domingos
    ('211f5404-3f0e-451d-ac2c-a6f0695e9175'), -- Famille Beijinho
    ('7264711b-9b18-4838-a44b-b9155217325b'), -- Famille Mabanza Joël
    ('8d0377ba-4ccb-4a9b-b892-e06f2a43b71b'), -- Famille Landu (table 41)
    ('6fe076d4-c0f5-4572-bb2e-a94e5b833f79'), -- Famille Pierrefitte
    ('4a9de975-da8e-45df-abd2-7512cb6f7cd5'), -- Ashnee Barclay (supprimée)
    ('c2488cbc-6bc3-4d0d-8aac-6aadb8697e2d'), -- Famille Mwinba (supprimée)
    ('85189e5a-4b73-4732-a5db-1fc463a02e5b'), -- Lina Kumpesa (supprimée)
    ('64237ac3-8bd3-4e5d-9a93-4f01a0e24219'), -- Grâce Ndonga (supprimée)
    ('04dbe3b8-677e-47cd-bd76-5b94e45f81a6'); -- Sister 1 Malungu (supprimée)

  if not exists (select 1 from import_backups where snapshot->>'kind' = 'v1.79.2_sync_guest_list_66') then
    insert into import_backups (event_id, agent_id, snapshot, invitations_count)
    select v_event, null, jsonb_build_object(
      'kind', 'v1.79.2_sync_guest_list_66',
      'invitations', (select jsonb_agg(to_jsonb(i)) from invitations i where i.id in (select id from tmp_sync_ids)),
      'guests', (select jsonb_agg(to_jsonb(g)) from guests g
                 join invitation_guests ig on ig.guest_id = g.id
                 where ig.invitation_id in (select id from tmp_sync_ids)),
      'invitation_guests', (select jsonb_agg(to_jsonb(ig)) from invitation_guests ig
                            where ig.invitation_id in (select id from tmp_sync_ids))
    ), (select count(*) from invitations where event_id = v_event);
  end if;

  -- Échange Lys Landu (-> 30) / Roger Makongo (-> 41).
  update invitations set table_id = v_t30
    where id = '16310b94-9c93-4e98-81a8-b9931cbbf72b' and nombre_arrive = 0 and table_id is distinct from v_t30;
  update invitations set table_id = v_t41
    where id = '99f91736-f559-4c5b-a77c-41478645dea4' and nombre_arrive = 0 and table_id is distinct from v_t41;

  -- Noms (texte « Membres: » des notes et nom de l'invitation).
  update invitations set notes = replace(notes, 'Epouse Mvovi', 'Maman Mvovi')
    where id = '4c598c1e-e165-419e-8409-6168c265449f';
  update invitations set notes = replace(notes, ', Julie Indanda', ', Tata Julie Indanda')
    where id = '80566d47-c7d5-4846-b3a7-367656677b2b';
  update invitations set nom_affichage = 'Ya Lale Culumbu'
    where id = '008558db-41aa-4934-bc2f-ed8903d09d30';
  update invitations set notes = replace(notes, 'Acacia Nsasi', 'Acacia Nzasi')
    where id = 'c74a9163-d790-4d16-b29a-76496e688f68';
  update invitations set nom_affichage = 'Famille Eliano',
      notes = replace(notes, 'Membres: Roger (Amy Eliano) Culumbu, Accompagnateur Amy Eliano, Accompagnateur Amy Eliano',
                             'Membres: Roger (Ami Eliano) Culumbu, Artiste VIP Ango Stars, Artiste Ango Stars')
    where id = '56c5e24a-e07f-4813-a210-1822b515f5d8';
  update invitations set nom_affichage = 'Raphael Opetum Isei Ngalula'
    where id = '526628b0-a410-4f3c-bf42-c424e6a68775';
  update invitations set notes = replace(notes, 'Epouse Domingos', 'Maman Domingos')
    where id = '900b66bd-f60d-49d9-8d05-1b676d304764';
  update invitations set notes = replace(notes, 'FOFO JAH', 'Kizomba Artist')
    where id = '211f5404-3f0e-451d-ac2c-a6f0695e9175';
  update invitations set notes = regexp_replace(notes, 'Joeliane Elmacin$', 'Joeliane Elmacin Lumbu')
    where id = '7264711b-9b18-4838-a44b-b9155217325b';
  update invitations set notes = replace(notes, 'Allegria Mpilingi', 'Solena Marzollo')
    where id = '8d0377ba-4ccb-4a9b-b892-e06f2a43b71b';
  update invitations set nom_affichage = 'Famille Moussaoui',
      notes = replace(notes, 'Membres: Greg Pierrefitte, Maeva Pierrefite, Julia Pierrefite',
                             'Membres: Greg Moussaoui, Maeva Moussaoui, Julia Moussaoui')
    where id = '6fe076d4-c0f5-4572-bb2e-a94e5b833f79';

  -- Suppressions demandées : sans table, 0 arrivée, aucun scan.
  create temporary table tmp_sync_remove on commit drop as
  select i.id from invitations i
  where i.id in ('4a9de975-da8e-45df-abd2-7512cb6f7cd5', 'c2488cbc-6bc3-4d0d-8aac-6aadb8697e2d',
                 '85189e5a-4b73-4732-a5db-1fc463a02e5b', '64237ac3-8bd3-4e5d-9a93-4f01a0e24219',
                 '04dbe3b8-677e-47cd-bd76-5b94e45f81a6')
    and i.table_id is null
    and i.nombre_arrive = 0
    and not exists (select 1 from checkins c where c.invitation_id = i.id)
    and not exists (select 1 from overflow_assignments o where o.invitation_id = i.id);

  create temporary table tmp_sync_remove_guests on commit drop as
  select ig.guest_id from invitation_guests ig
  where ig.invitation_id in (select id from tmp_sync_remove)
    and not exists (select 1 from invitation_guests other
                    where other.guest_id = ig.guest_id
                      and other.invitation_id not in (select id from tmp_sync_remove));

  delete from guests where id in (select guest_id from tmp_sync_remove_guests);
  delete from invitations where id in (select id from tmp_sync_remove);
end $$;
