# Changelog

Toutes les évolutions fonctionnelles significatives de l'application sont consignées ici.
Le projet suit Semantic Versioning (`MAJOR.MINOR.PATCH`). Voir `docs/VERSIONING.md`.

## [1.10.0] — 2026-08-23

### Ajouté
- Plan de salle interactif sur `/plan-table` (`components/FloorPlan.tsx`), derrière un bouton dédié « 🗺️ Voir le plan de salle » replié par défaut (demande explicite de Gersom : ne pas imposer l'image en haut d'une page déjà longue). Schéma SVG redessiné à la main à partir du plan papier fourni — l'image d'origine ne pouvait pas être intégrée telle quelle (transmise dans le chat, jamais reçue comme fichier téléchargeable malgré deux tentatives) ; ce choix a un avantage réel : rendu net à toute résolution, dans la charte de couleurs de l'app, contrairement à une photo intégrée telle quelle.
- Les 40 tables (1 à 40) sont numérotées et cliquables sur le plan; la table de réserve (41) n'y figure pas volontairement, son emplacement physique n'étant pas encore défini (à ajouter plus tard).
- Sélection bidirectionnelle, entièrement côté client sur les données déjà chargées (aucun nouvel appel réseau, aucune nouvelle capacité) : appuyer sur une table du plan la surligne en vert et affiche sa fiche (mêmes informations qu'une carte de la liste) juste en dessous du plan; un bouton 📍 sur chaque carte de la liste habituelle (tables 1-40 uniquement) sélectionne la même table et fait défiler la page jusqu'au plan, en l'ouvrant au besoin. Le clic normal sur le reste d'une carte continue de naviguer vers `/tables/[tableId]`, inchangé. Le bouton 📍 est un contrôle frère du lien plutôt qu'un bouton imbriqué dans celui-ci, afin d'éviter les interactions invalides et les navigations accidentelles.
- Accessible à tous les rôles ayant `viewTables` (les cinq) : lecture seule pure, aucune permission n'était nécessaire ni ajoutée.

### Tests
- Nouvelle suite `npm run test:floorplan` : les 40 tables (et uniquement elles, jamais la 41) ont une position sur le plan, les cibles tactiles ne se chevauchent pas et restent entièrement dans le viewBox, le plan est bien replié par défaut derrière son bouton, les tables sont utilisables au clavier, le bouton 📍 n'est pas imbriqué dans le lien de navigation, et la table de réserve n'a jamais de bouton 📍 (inspection du code source, même convention que les tests staff/tags de ce lot).
- Vérification visuelle : rendu du SVG exporté en HTML statique et capturé via Chromium headless (sans dépendre d'un environnement Supabase) — a permis de repérer et corriger un chevauchement réel (étiquette « Couloir Est » débordant sur les pièces voisines dans un couloir trop étroit pour du texte horizontal, corrigé par rotation à 90° des étiquettes de colonnes étroites).
- `npx tsc --noEmit`, `npm run test:roles` (13/13), `npm run test:members` (3/3), `npm run test:floorplan` (7/7), `python3 -m unittest tests.test_import_scripts` (11/11) et `npm run build` exécutés avec succès.

## Données — 2026-08-23 (réimport complet, guestlist_20.csv)

### Réimport complet de la liste d'invités
- Remplacement complet des invitations de l'événement « Mariage Nelly & Gersom » à partir de `guestlist_20.csv`, avec autorisation explicite de Gersom (« MET A JOURS AVEC CETTE SOURCE »).
- Sauvegarde préalable : `invitations_backup_20260823_v20`, avec RLS activé immédiatement dans la même migration (`alter table ... enable row level security` juste après le `create table ... as select`), pour ne pas reproduire l'oubli du réimport du 22/08.
- Avant : 226 invitations, 388 personnes prévues, 61 Staff (44 sans table), 0 arrivée réelle, 0 « ne viendra pas » — vérifié explicitement avant écriture : rien à perdre, aucune confirmation supplémentaire nécessaire au-delà de l'instruction elle-même.
- Après : 234 invitations, 387 personnes prévues, 226 avec table, 8 Staff sans table, 0 arrivée, 0 « ne viendra pas ».
- Conflit de double-tag table : Henry Kiadi Ndiongo portait à la fois `T015` et `T025` dans `guestlist_20.csv` ; placé table 15 (table la moins remplie entre les deux), conformément à la règle déjà appliquée lors des réimports précédents.
- Débordements de capacité sur tables explicitement taguées, redistribués vers la table la moins remplie parmi celles sans étiquette (« reste ») : Famille Okito → table 23, Famille Mpapa → table 39, Nsimba Mambakasa → table 39, Famille Bitumazala → table 23.
- Vérification : comparaison automatisée champ par champ (nom, groupe, nombre prévu, téléphone, catégorie, côté, tags, statut de placement) et numéro de table, contre le JSON source vérifié (`scripts/build_plan_from_csv.py` puis `scripts/assign_tables_from_labels.py`) — correspondance parfaite sur les 234 lignes, aucune ligne fabriquée ni manquante. Les cinq cas ci-dessus revérifiés individuellement par requête nominative après écriture.
- RLS de `invitations_backup_20260823_v20` confirmé actif (`pg_class.relrowsecurity = true`) directement après la migration.
- Aucun changement de code applicatif — réimport de données uniquement.

## [1.9.0] — 2026-08-23

### Sécurité et permissions
- Nouvelle capacité dédiée `manageTags` dans `lib/permissions.ts`, séparée de `manageMembers`. Signalé par Gersom : agent scan (rôle de scan/entrée) n'a plus besoin de pouvoir gérer les étiquettes d'une invitation (côté, rôle staff, `notable`…) — retiré pour ce rôle. Admin, directeur et placeur conservent `manageTags` (comportement inchangé). `manageMembers` (renommer, gérer les membres du groupe) reste inchangé pour agent scan.
- `app/checkin/[invitationId]/page.tsx` : la section « 🏷️ Étiquettes » utilise désormais `manageTags` au lieu de `manageMembers` pour son affichage; le bloc « Renommer » reste sur `manageMembers`.
- `/api/invitations/tags/add` et `/api/invitations/tags/remove` vérifient désormais `hasCapability(user.role, 'manageTags')` au lieu d'une liste de rôles recréée localement (`['admin', 'directeur', 'placeur', 'agent_checkin']`), corrigeant au passage une entorse à la règle centrale de `CLAUDE.md`. `/api/invitations/rename` est corrigée de la même façon vers `hasCapability(user.role, 'manageMembers')`, sans changement de comportement (mêmes rôles qu'avant).

### Tests
- Nouveau test : agent scan n'a pas `manageTags` mais garde `manageMembers`; admin/directeur/placeur gardent `manageTags`; visibilité ne l'a jamais eu. Vérifie aussi par inspection du code source que les routes tags utilisent `hasCapability` et ne recréent plus de liste de rôles locale.
- `npx tsc --noEmit`, `npm run test:roles` (13/13), `npm run test:members` (3/3), `python3 -m unittest tests.test_import_scripts` (11/11) et `npm run build` exécutés avec succès.

## [1.8.1] — 2026-08-23

### Corrigé
- Couleurs `nelly` (`#9d5b7d` → `#d6336c`) et `gege` (`#2f6f83` → `#1d4ed8`) dans `tailwind.config.ts`, utilisées pour les pastilles de côté sur `/plan-table` et `/search`, ainsi que les compteurs par côté. Signalé par Gersom : les deux teintes d'origine étaient difficiles à différencier d'un coup d'œil sur un petit écran. Les nouvelles teintes rose/framboise et bleu indigo sont mieux séparées, avec un contraste texte sur fond blanc d'environ 4,62:1 et 6,70:1.
- `tailwind.config.ts` reste l'unique source des valeurs hexadécimales; `lib/types.ts` ne contient que la correspondance vers les classes `bg-nelly` et `bg-gege`. Aucune teinte dupliquée en dur dans les composants.

### Tests
- `npx tsc --noEmit`, `npm run test:roles`, `npm run test:members`, `python3 -m unittest tests.test_import_scripts` et `npm run build` exécutés avant le push. Changement purement visuel, aucun test automatisé supplémentaire.

## [1.8.0] — 2026-08-23

### Ajouté
- `/staff` propose désormais deux onglets « Sans table » / « Avec table », visibles uniquement pour admin, directeur et visibilité (`viewAllStaff`). Permet de vérifier rapidement les arrivées du reste du staff (avec table) sans repasser par la vue d'ensemble de `/dashboard`. Onglet « Sans table » sélectionné par défaut, identique à la liste opérationnelle déjà en place. Placeur et agent scan ne voient pas les onglets : rien à départager pour eux, ils ne voient déjà que le staff sans table.
- Le découpage réutilise la détection centralisée du tag `notable` (`isStaffWithoutTable`, tolérante aux accents, tirets et espaces) — aucune nouvelle règle de classification.
- La page consomme exclusivement `GET /api/staff` : la session signée et `viewAllStaff` sont vérifiées côté serveur, et les lignes masquées ne sont jamais envoyées aux placeurs ou agents scan. La souscription Supabase Realtime côté navigateur est remplacée par un rafraîchissement périodique et au retour au premier plan via cette API protégée, afin qu'aucun payload Staff non filtré ne transite par le client. La jointure de table existante permet d'afficher le numéro de table dans l'onglet « Avec table », sans nouvel appel lors du changement d'onglet ni nouvelle capacité.
- Corrige aussi la recherche : une saisie alphabétique ne correspond plus automatiquement à toutes les lignes possédant un téléphone lorsque la partie numérique recherchée est vide.

### Contexte
- `/staff` avait été recentré le 23/08/2026 sur le seul personnel sans table, avec une barre de recherche et un bouton d'appel direct. Cette liste opérationnelle reste la vue par défaut pour tous les rôles.

### Tests
- Ajoute un test de non-régression garantissant que `/staff` consomme `/api/staff`, ne lit pas directement `invitations` depuis le client et conserve le filtrage serveur `viewAllStaff`.
- `npx tsc --noEmit`, `npm run test:roles`, `npm run test:members`, `python3 -m unittest tests.test_import_scripts` et `npm run build` exécutés avant le push.

## Données — 2026-08-23 (réimport complet, guestlist_19.csv)

### Réimport complet de la liste d'invités
- Remplacement complet des invitations de l'événement « Mariage Nelly & Gersom » à partir de `guestlist_19.csv`, avec autorisation explicite et répétée de Gersom (« Non, remplace tout sans exception »).
- Sauvegarde préalable : `invitations_backup_20260823`, avec RLS activé immédiatement après création (contrairement à la sauvegarde du réimport précédent, corrigée après coup — voir section RLS ci-dessous).
- Avant : 225 invitations, 386 personnes prévues, 61 Staff, 44 sans table, 1 arrivée réelle enregistrée (Famille Bolamba).
- Après : 226 invitations, 388 personnes prévues, 61 Staff, 44 sans table, 0 arrivée. Remise à zéro assumée par Gersom : l'arrivée de Famille Bolamba et le statut « ne viendra pas » de Famille Makopa étaient des tests, pas des données réelles (confirmé explicitement avant l'import).
- Conflit de double-tag table (Famille Simao) signalé lors du réimport du 22/08 : absent de `guestlist_19.csv`, corrigé à la source ; aucune action nécessaire cette fois.
- Vérification : comparaison automatisée champ par champ (nom, groupe, nombre prévu, téléphone, catégorie, côté, tags, statut de placement) et numéro de table, contre le JSON source vérifié (`scripts/build_plan_from_csv.py` puis `scripts/assign_tables_from_labels.py`) — correspondance parfaite sur les 226 lignes, aucune ligne fabriquée ni manquante.
- Incident évité en cours de route : une première tentative de transcription manuelle du SQL généré a scindé par erreur un champ `notes` en deux littéraux au lieu d'un seul avec séparateur ` | `. Postgres a rejeté toute la transaction avant écriture (`VALUES lists must all be the same length`) ; vérifié immédiatement que la production était inchangée. La transcription corrigée a ensuite été validée par `diff` contre le fichier SQL généré par script avant nouvelle tentative, conformément au garde-fou de `docs/QE_QA_PROCESS.md` §5.
- Aucun changement de code applicatif — réimport de données uniquement.

## [1.7.0] — 2026-08-23

### Corrigé
- `initialize_invitation_members` ajuste désormais `nombre_prevu` à la baisse lorsqu'une ligne est retirée du brouillon avant le premier enregistrement de la liste. Le statut est recalculé dans la même transaction; une liste égale ou plus longue ne fait jamais grandir le nombre prévu.
- Cas réel : Famille Bolamba, annoncée à 2 personnes; Koffi retiré avant l'enregistrement; le groupe doit devenir complet à 1/1 plutôt que rester partiel à 1/2.
- L'écran explique explicitement cette conséquence avant l'enregistrement.

### Sécurité et audit
- La route `/api/members/initialize` utilise la capacité centrale `manageMembers` au lieu d'une liste locale de rôles.
- L'initialisation reste sérialisée par verrouillage de l'invitation et journalise le nombre prévu avant/après ainsi que l'indicateur d'ajustement.

### Migration et production
- Ajoute `0024_initialize_members_adjust_prevu.sql`. Le numéro `0020` fourni initialement n'a pas été réutilisé, car il appartient déjà au transfert/échange en lot.
- Le comportement était déjà appliqué directement en production avec autorisation explicite. La définition active a été vérifiée en lecture seule le 23/08/2026; aucune nouvelle écriture de production n'a été effectuée pendant ce merge.

### Tests
- Ajoute `npm run test:members` : baisse uniquement, absence de hausse implicite, verrouillage, audit avant/après et capacité `manageMembers`.

## Données — 2026-08-23

### Sécurité : RLS manquant sur `invitations_backup_20260822`
- `create table ... as select` ne copie jamais le RLS de la table source — la sauvegarde créée pendant le réimport du 22/08/2026 (voir section Données du même jour) était donc restée exposée sans protection via l'API PostgREST. Signalé par Gersom via l'advisor Supabase (`rls_disabled_in_public`, niveau `ERROR`).
- Corrigé : `supabase/migrations/0025_enable_rls_invitations_backup.sql` — `alter table invitations_backup_20260822 enable row level security;`, sans policy (deny-all pour anon/authenticated via l'API ; `service_role` continue de tout voir comme d'habitude — c'est une sauvegarde interne, jamais censée être interrogée par l'application).
- Vérifié : l'avertissement `ERROR` a disparu des advisors Supabase après application; seuls des `INFO` bénins (même famille que `audit_logs`/`users`, déjà RLS-activées sans policy par conception) subsistent.
- Aucun code applicatif modifié — migration Supabase uniquement.

## [1.6.4] — 2026-08-23

### Sécurité et permissions
- Centralise toute la logique Staff dans deux capacités de `lib/permissions.ts` : `viewStaff` pour accéder à l'écran/API et `viewAllStaff` pour recevoir la vue complète. L'API, la page Staff, le QR/raccourci Scan et la section du dashboard utilisent désormais `hasCapability` au lieu de recopier des listes de rôles.
- Conserve les barrières de v1.6.3 : session signée vérifiée côté serveur, filtrage avant envoi au navigateur et réponse privée sans cache.
- Ajoute `docs/CLAUDE_HANDOFF_STAFF_ACCESS.md`, fiche de transmission destinée à Claude avec matrice des rôles, architecture de sécurité, politique sans PIN et checklist de modification.

### Tests
- Étend le test de permissions afin de couvrir explicitement `viewStaff` et `viewAllStaff` pour les cinq rôles.

## [1.6.3] — 2026-08-23

### Sécurité
- `/staff` ne télécharge plus toutes les invitations avant de les filtrer dans le navigateur. La nouvelle route `GET /api/staff` valide le cookie de session signé côté serveur et ne renvoie aux placeurs/agents scan que le personnel `notable` sans table; admin, directeur et visibilité reçoivent la vue complète prévue par la règle métier.
- La réponse Staff est privée et non mise en cache. La clé Supabase de service reste confinée au serveur.
- Les noms de comptes peuvent rester documentés, mais aucun code PIN ni secret d'authentification n'est conservé dans Git.

### Tests
- Ajoute un test de la matrice de visibilité Staff et de la reconnaissance tolérante du tag sans table.

## [1.6.2] — 2026-08-23

### Corrigé
- `/staff` adapte maintenant sa liste au rôle : admin, directeur et visibilité conservent la vue d'ensemble, tandis que placeur et agent scan voient uniquement le personnel marqué `notable` et accueilli sans table. Le staff déjà placé continue son check-in normal depuis sa table.
- La documentation des comptes reste sans codes PIN : aucun secret d'authentification n'est ajouté au dépôt.

### Tests
- Tests de permissions, vérification TypeScript et build Next.js exécutés avant publication.

## [1.6.1] — 2026-08-22

### Corrigé
- `app/scan/page.tsx` : le QR littéral `STAFF` pouvait être refusé à tort pour un rôle autorisé si le badge était scanné avant le chargement asynchrone de `useSessionRole()`. La caméra reste désormais démontée tant que `role === null`, puis s'active une fois le rôle disponible.
- Le raccourci « Staff » en bas de `/scan`, resté limité à admin/directeur par oubli, est aligné sur le QR et visible aussi pour placeur/agent scan.

### Tests
- 11 tests d'import, 10 tests de permissions, `npx tsc --noEmit` et `npm run build` passants. Le scénario de scan immédiat reste documenté comme vérification manuelle de composant dans `docs/QA_SCENARIOS.md`.

## Données — 2026-08-22

### Réimport complet de la liste d'invités (`guestlist_18.csv`)
- Remplacement complet de `invitations` en production, déjà effectué avec autorisation explicite. Aucun code applicatif ni schéma modifié par cette opération.
- Avant : 226 invitations, 385 personnes prévues, 59 Staff. Après, vérifié en lecture avant ce merge : **225 invitations, 387 personnes prévues, 61 Staff et 44 sans table**.
- Sauvegarde `invitations_backup_20260822` confirmée présente; aucun check-in n'était enregistré avant l'opération.
- « Accompagnant non-nommé » affiche maintenant « Photographe Assistant Auguste » depuis les données source.
- La première tentative SQL a échoué et sa transaction a été annulée. La seconde contenait 7 invitations absentes du CSV, détectées par comparaison automatisée puis supprimées immédiatement sans check-in associé. Une comparaison exhaustive des champs a ensuite confirmé les 225 invitations attendues.
- Garde-fou : ne jamais retranscrire manuellement un gros bloc SQL de données réelles; générer l'écriture depuis la source et comparer automatiquement la base au fichier vérifié après toute opération de masse.
- `Needs_Table_Gege`/`Needs_Table_Nelly` est correctement traité : pas d'auto-assignation et pas de classification Staff.

## [1.6.0] — 2026-08-22

### Ajouté / Corrigé
- `/staff` et le QR littéral `STAFF` sont maintenant accessibles à placeur et agent scan (consultation + check-in), en plus d'admin/directeur et de visibilité en lecture seule. Cette règle a été revue après confirmation que le staff sans table se présente à l'entrée générale tenue par placeur/agent scan.
- `lib/permissions.ts` : suppression du garde-fou qui excluait spécifiquement `/staff` pour placeur/agent scan.
- `app/scan/page.tsx` : le QR littéral `STAFF` redirige vers `/staff` pour admin/directeur/placeur/agent scan.

### Documentation
- `docs/BUSINESS_RULES.md`, `docs/QA_SCENARIOS.md` et `docs/QE_QA_PROCESS.md` alignés sur cette règle d'accès.

### Tests
- `tests/permissions.test.ts` vérifie l'accès des cinq rôles et maintient visibilité en lecture seule; 10 tests de permissions passants.

### Note
- Aucune migration Supabase propre à v1.6.0. Les migrations fonctionnelles 0020, 0021 et le correctif 0023 du lot combiné ont été appliqués en production avant le push de l'application; aucune ligne métier n'a été ajoutée, modifiée ou supprimée.

## [1.5.1] — 2026-08-22

### Corrigé
- `scripts/build_plan_from_csv.py` : nouveau tag With Joy `Needs_Table_Gege`/`Needs_Table_Nelly` (Gege ou Nelly n'a pas encore assigné de table à la main) découvert dans un export du jour — sans correction, aurait été traité à tort comme un tag de rôle staff (`category = 'Staff'`) **et** aurait été auto-assigné par le pool aléatoire au lieu d'attendre un placement manuel. Traité maintenant exactement comme `notable` (jamais d'auto-assignation, `no_table = True`), sans être du staff ; toléré en casse variable. Un tag de table explicite reste prioritaire (même règle que `notable`).
- La même règle est appliquée aux étiquettes modifiées depuis l'application : `0023_sync_needs_table_tag_rules.sql` recrée `add_invitation_tag`/`remove_invitation_tag` pour exclure aussi ces tags, en casse variable, du calcul Staff. Cette migration corrective est nécessaire car `0022` est déjà appliquée en production.

### Documentation
- `docs/QE_QA_PROCESS.md` §4 : nouveau cas 14 dans la matrice d'import With Joy.
- `docs/BUSINESS_RULES.md`, `docs/DATA_AND_FORMS.md` : règle documentée.

### Tests
- `tests/test_import_scripts.py` : `test_needs_table_gege_nelly_reste_sans_table_et_nest_pas_staff` et contrôle de synchronisation des migrations SQL (11 tests au total), couvrent aussi la casse variable et la priorité d'un tag de table explicite.

### Note
- Correction préventive : aucune donnée réelle réimportée. La migration de fonctions SQL `0023` a été appliquée en production sans modification de lignes afin que la saisie manuelle et l'import appliquent la même règle. Aucun réimport de production n'a été effectué : seul un extrait CSV de démonstration (6 personnes) a été fourni pour illustrer le nouveau tag.

## [1.5.0] — 2026-08-22

### Ajouté
- `/checkin/[invitationId]` : section « 🏷️ Étiquettes » — ajouter/retirer n'importe quel tag (raccourcis pour `Côté_Gege`, `Côté_Nelly`, `SERVICES` (Staff), `Photographe`, `Prestataire`, `DJ_Animation` (Animation), `notable` (Sans table), ou saisie libre), sans passer par un réimport CSV. But : marquer sur place (photographe, prestataire, animation trouvés le jour J...) qui fait partie du staff, disponible aux mêmes rôles que le renommage (admin, directeur, placeur, agent scan).
- `Côté_Gege`/`Côté_Nelly` synchronisent directement la colonne `cote` et sont mutuellement exclusifs (ajouter l'un retire l'autre).
- Ajouter un tag de rôle (tout ce qui n'est ni un tag de table ni un tag « non-rôle » connu) place automatiquement `category = 'Staff'`, exactement comme à l'import ; retirer un tag de rôle ne repasse `category` à vide que si c'était le dernier restant — jamais si l'invitation garde un autre rôle.
- `supabase/migrations/0022_manage_invitation_tags.sql` : fonctions `add_invitation_tag` et `remove_invitation_tag`, idempotentes, avec une ligne d'audit (`invitation_tag_add`/`invitation_tag_remove`) par changement réel.
- `/api/invitations/tags/add` et `/api/invitations/tags/remove`.

### Documentation
- `docs/BUSINESS_RULES.md` : section « Étiquettes d'une invitation », 1 ligne de matrice des rôles.
- `docs/DATA_AND_FORMS.md` : contrat du formulaire.
- `docs/QA_SCENARIOS.md` : scénario 8ter.
- `docs/QE_QA_PROCESS.md` section 5 : garde-fou sur la réplication Python/SQL de la même règle métier (`is_role_tag`), à garder synchronisée si la liste des tags « non-rôle » évolue.

### Tests
- `python3 -m unittest tests.test_import_scripts` (9 tests), `npm run test:roles` (10 tests), `npx tsc --noEmit`, `npm run build` : tous passants — pas de nouveau test automatisé dédié (aucune capacité ni exclusion de route ajoutée dans `lib/permissions.ts`, même périmètre que le renommage déjà couvert).

### Note
- La migration `0022_manage_invitation_tags.sql` a été appliquée sur Supabase (projet `znqxmmrtvmhsfsnphjcv`) avant ce merge — fonctions SQL nouvelles uniquement (`create or replace`), aucune donnée existante touchée.

## [1.4.0] — 2026-08-22

### Ajouté
- `/checkin/[invitationId]` : « ✎ Renommer cette invitation » corrige `nom_affichage` directement (sans passer par « Gérer les membres », qui ne permettait que d'ajouter/retirer/nommer des membres détaillés, jamais de renommer le nom affiché du groupe lui-même). Disponible aux mêmes rôles que la gestion des membres (admin, directeur, placeur, agent scan).
- `/checkin/[invitationId]/merge` : « ⇄ Fusionner avec un autre groupe » recherche une autre invitation par nom et fusionne l'invitation courante dedans — cas d'usage : un « Accompagnant non-nommé » identifié après coup comme appartenant à un autre groupe. Additionne les personnes prévues/arrivées/supplémentaires ; réattache tout l'historique (checkins, débordements, membres détaillés, exceptions, audit) vers la cible avant de supprimer la source, rien n'est perdu. Avertissement (non bloquant) si les deux invitations sont `category = 'Staff'` — voir docs/BUSINESS_RULES.md.
- `supabase/migrations/0021_rename_and_merge_invitations.sql` : fonctions `rename_invitation` et `merge_invitations`.
- `/api/invitations/rename` et `/api/invitations/merge`.

### Corrigé pendant l'audit de merge
- `merge_invitations` recalcule désormais `statut` après addition des compteurs ; sans cela, une cible auparavant complète pouvait rester affichée complète après fusion avec des personnes non arrivées.

### Documentation
- `docs/BUSINESS_RULES.md` : section « Renommer et fusionner des invitations », 2 lignes de matrice des rôles.
- `docs/DATA_AND_FORMS.md` : contrat des deux formulaires.
- `docs/QA_SCENARIOS.md` : scénario 8bis.
- `docs/QE_QA_PROCESS.md` section 5 : deuxième limite de `matchesPrefix` découverte — ne peut pas bloquer un sous-chemin qui suit un segment dynamique (`/checkin/[id]/merge`) ; protection déplacée côté API (`/api/invitations/merge`), même principe déjà établi pour `visibilite` sur `/tables/move/[invitationId]`.

### Tests
- `tests/permissions.test.ts` : `agent scan ne peut pas fusionner deux invitations (mais peut renommer)` (10 tests au total).

### Note
- La migration `0021_rename_and_merge_invitations.sql` a été appliquée en production avant le push de cette release (fonctions SQL nouvelles uniquement, aucune donnée touchée).

## [1.3.0] — 2026-08-22

### Ajouté
- Sélection multiple sur `/table/[tableId]` et `/tables/[tableId]` (« Sélectionner plusieurs invités », case à cocher par invitation), avec deux actions en lot :
  - **Transférer** : déplace les invitations sélectionnées vers une seule table de destination choisie sur `/tables/move-multiple`.
  - **Échanger** : un groupe quitte la table A pour la table B pendant qu'un autre groupe quitte B pour A, en une seule confirmation — les deux groupes peuvent avoir des tailles différentes (ex. 2 personnes contre 4).
- `supabase/migrations/0020_bulk_move_and_swap_invitations.sql` : fonctions `move_invitations_table` (variante en lot de `move_invitation_table`, 0008) et `swap_invitations_between_tables`, mêmes garanties que le déplacement individuel (pas de blocage de capacité, audit `invitation_move` par invitation) — une invitation disparue entre-temps est ignorée plutôt que de faire échouer tout le lot.
- `/api/move-invitations` et `/api/swap-invitations`, mêmes rôles autorisés que `/api/move-invitation` (admin, directeur, placeur).
- `components/TablePicker.tsx` : recherche + liste de tables avec occupation, extraite de `/tables/move/[invitationId]` pour être réutilisée par le nouveau parcours en lot.

### Corrigé pendant l'audit de merge
- Les RPC de transfert/échange revérifient l'événement de la table cible, la table source réelle de chaque invitation et l'absence de sélection commune aux deux côtés ; un appel API altéré ne peut donc pas déplacer un groupe d'un autre événement ou d'une troisième table.

### Corrigé
- `lib/permissions.ts` : `/tables/move-multiple`, `/api/move-invitations` et `/api/swap-invitations` n'étaient pas couverts par l'exclusion existante sur `/tables/move`/`/api/move-invitation` pour `agent_checkin` (`matchesPrefix` ne matche pas un nom de route qui commence pareil sans `/` derrière — voir `docs/QE_QA_PROCESS.md` §5). Ajoutés explicitement à l'exclusion.

### Documentation
- `docs/BUSINESS_RULES.md` : nouvelle section « Réorganisation des tables (transfert/échange en lot) », ligne ajoutée à la matrice des rôles.
- `docs/DATA_AND_FORMS.md` : contrat du formulaire (champs, validation, capacité, effets secondaires) pour le transfert/échange en lot.
- `docs/QA_SCENARIOS.md` : scénario 10bis.
- `docs/QE_QA_PROCESS.md` : §5 « Garde-fous transverses », découverte du gap `matchesPrefix`.

### Tests
- `tests/permissions.test.ts` : `agent scan ne peut pas transferer ou echanger en lot` (9 tests au total).

### Note
- La migration `0020_bulk_move_and_swap_invitations.sql` a été appliquée en production avant le push de cette release (fonctions SQL nouvelles uniquement, aucune donnée touchée).

## [1.2.3] — 2026-08-22

### Corrigé
- `/plan-table` affichait « 3 personnes excédentaires actuellement en réserve » alors qu'aucune place de réserve n'était utilisée : le calcul comptait toute invitation `table_id = NULL` comme un débordement en réserve, y compris les 3 membres du staff `notable` volontairement sans table (accueil direct via QR `STAFF`). Sépare désormais un bucket `sansTable` distinct de l'excédentaire réel (table 41), avec une ligne dédiée dans la carte de capacité.
- `/dashboard` : la jauge « Remplissage de la salle » n'indiquait pas où se situait la limite des 400 places officielles dans sa graduation sur 410 (officielles + réserve). `CapacityGauge` accepte désormais un seuil `warningAt` qui marque cette limite et fait passer la barre en rouge au-delà, même avant les seuils par défaut (75 %/95 %) ; le libellé affiche `X / 400 (+10 réserve)` au lieu d'un `/410` peu clair.

### Documentation
- Ajoute la ligne 13 à la matrice de `docs/QE_QA_PROCESS.md` (invitation sans table comptée à tort en excédentaire) — dette de test connue : ce sont des composants React, non couverts par la suite Python/`tests/permissions.test.ts` actuelle, à vérifier manuellement via `docs/QA_SCENARIOS.md` jusqu'à l'ajout d'un test de composant.
- `docs/QA_SCENARIOS.md` : ajoute deux vérifications de capacité (sans-table jamais compté en excédentaire, seuil des 400 visible sur la jauge).

### Tests
- `python3 -m unittest tests.test_import_scripts` (9 OK), `npm run test:roles` (8 OK), `npx tsc --noEmit` (clean), `npm run build` (OK). Pas de test automatisé nouveau pour ce correctif (composants React `/plan-table` et `/dashboard`, hors périmètre des suites de test actuelles — voir Documentation).

## [1.2.2] — 2026-08-22

### Corrigé
- `/staff` affichait « Pas de numéro enregistré » pour tout le monde : les 190 invitations issues du dernier import With Joy avaient été insérées sans `telephone`. Corrigé pour les imports futurs dans `scripts/build_plan_from_csv.py` (extraction de `phone number` par personne) et réappliqué en production sur les invitations existantes (voir Données ci-dessous).
- Le tag de rôle staff (`SERVICES`/tag de rôle) n'était isolé que lorsqu'il portait un tag de table en conflit avec le reste du foyer : un foyer où une seule personne était staff apparaissait entièrement comme un seul groupe « Famille X » dans `/staff`, empêchant de cocher l'arrivée de chacun séparément. `scripts/build_plan_from_csv.py` isole désormais chaque personne staff dans sa propre invitation individuelle, conformément à la règle déjà documentée dans `docs/BUSINESS_RULES.md`.
- `Groomsman`/`Bridesmaid` (cortège) étaient comptés comme des tags de rôle staff et faisaient donc apparaître ces personnes sur `/staff` alors qu'elles n'en font pas partie. `scripts/build_plan_from_csv.py` les exclut désormais du calcul de `category = 'Staff'`.
- Trois membres du staff tagués `notable` sans tag de table explicite (Auguste Quittarac, DJ Alain Diakuanu, Messi Matoko) avaient malgré tout reçu une table lors du réimport ci-dessous, alors que la règle documentée les laisse volontairement sans table (accueil direct via QR `STAFF`). Corrigé en production (voir Données).
- `/staff` n'affichait aucune information de table : ajoute une ligne « Table N — Libellé » (ou « Sans table ») par personne, jointe via `table:tables(*)`.
- Une personne avec deux tags de table (ex: `T027` + `T036`) était placée sur le premier sans aucun avertissement : le second tag disparaissait silencieusement. `scripts/build_plan_from_csv.py` affiche désormais un `WARNING` explicite (constaté en production sur Cedrik LeCaous et Famille Simao — placement inchangé, juste maintenant visible).

### Données
- Production (event `Mariage Nelly & Gersom`, statut `test`) : les 190 invitations du dernier import (385 personnes) ont été supprimées et réinsérées avec la logique corrigée — 226 invitations, mêmes 385 personnes, mêmes tables/côté/RSVP, `telephone` renseigné pour 168/226 (52/65 Staff), 65 invitations `category = 'Staff'` (au lieu de 46 foyers mêlant staff et non-staff). Aucun check-in, membre détaillé ni débordement existant : aucune donnée de ce type à préserver. Sauvegarde de l'état précédent conservée hors dépôt (192 invitations, JSON) avant l'opération.
- Correctif ciblé appliqué ensuite sur ce même réimport (mêmes 226 invitations, aucune ligne ajoutée/supprimée) : `category` remis à `NULL` pour 6 personnes du cortège (David-Junior Lukau, Deborah Yezi, Domingas Ferreira, Eutyche Lukau, Hadelin Yezi, Herve Menga — 59 invitations `Staff` au lieu de 65) ; `table_id` remis à `NULL` pour Auguste Quittarac, DJ Alain Diakuanu et Messi Matoko (3/59 `Staff` sans table, conforme à la règle `notable`).
- Demande explicite de Gersom (bouton/écran Staff : numéros de téléphone manquants, staff affiché par foyer au lieu d'individuellement, cortège compté à tort comme staff, staff `notable` réassigné à tort à une table, table manquante sur `/staff`).

### Tests
- Ajoute 9 tests à `tests/test_import_scripts.py`, couvrant chacun des 11 cas testables de la matrice de `docs/QE_QA_PROCESS.md` (individuation staff, cortège seul/combiné, double tag de table, RSVP décliné, débordement de table, saturation totale 410 places).

### Documentation
- Ajoute `docs/QE_QA_PROCESS.md` : processus QE (préventif, avant merge) et QA (réactif, quand un bug est signalé) pour les bugs, motivé directement par cette série de corrections sur `/staff`. Inclut une matrice exhaustive des cas limites connus des scripts d'import With Joy, à repasser en entier — pas seulement le cas signalé — à chaque changement de `scripts/build_plan_from_csv.py` ou `assign_tables_from_labels.py`. Documente aussi une découverte : l'avertissement `DEPASSEMENT` de `assign_tables_from_labels.py` est mathématiquement inatteignable avec l'algorithme actuel (chaque table hors réserve est capée à 10 dès l'insertion) — à trancher avec Gersom (supprimer ou garder comme garde-fou documenté). Référencé dans l'ordre de lecture de `CLAUDE.md` et la liste des documents versionnés de `docs/VERSIONING.md`.

## [1.2.1] — 2026-08-22

### Documentation
- Rétablit dans les règles métier la liste des noms de connexion par rôle.
- Les PIN restent volontairement exclus du dépôt public et sont gérés uniquement dans Supabase via `/admin/users`.
- Ajoute une règle explicite interdisant de stocker des secrets d'authentification dans Git.

## [1.2.0] — 2026-08-21

### Ajouté
- Écran `/staff` en temps réel avec totaux, téléphone, statut d'arrivée et badge « Sans table ».
- Reconnaissance du QR spécial `STAFF` et accès manuel depuis l'écran Scan.
- Résumé des arrivées du staff sur le dashboard pour admin et directeur.

### Modifié
- `/staff` est consultable par les cinq rôles; le check-in reste limité aux rôles autorisés.
- Les futurs imports conservent sans table les groupes tagués `notable`, sauf si un tag de table explicite est présent.

### Données
- Aucune donnée de production ni aucun schéma Supabase modifié.

## [1.1.0] — 2026-08-21

### Ajouté
- Modèle de capacité à 41 tables : 40 tables normales + 1 table de réserve (table 41).
- Capacité officielle portée à 400 places; capacité absolue avec réserve : 410.
- Migration `0019_reduce_reserve_to_one_table.sql` pour versionner le changement de structure des tables.
- Récupération applicative en cas d'erreur de version/déploiement avec retour propre vers le login.
- Invalidation des sessions liées à une ancienne version de déploiement.
- Stratégie PWA corrigée pour ne plus conserver d'anciens assets Next.js `/_next/*`.
- Gouvernance de versioning et synchronisation obligatoire code/documentation.

### Modifié
- Durée maximale d'une session ramenée de 16 h à 12 h.
- Les tables 38, 39 et 40 sont désormais normales; la table 41 est l'unique réserve.
- Les écrans de plan de table utilisent désormais 400 comme capacité officielle.

### Documentation
- README, règles métier, assignation, données, QA, déploiement et instructions Claude alignés sur v1.1.0.

## [1.0.0] — Base initiale

- Application Next.js de check-in mariage.
- Authentification par nom/PIN, rôles, scan, recherche, tables, dashboard, check-in, débordements, historique et administration.
- Backend Supabase et PWA installable.
