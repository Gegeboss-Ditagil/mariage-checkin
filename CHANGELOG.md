# Changelog

Toutes les évolutions fonctionnelles significatives de l'application sont consignées ici.
Le projet suit Semantic Versioning (`MAJOR.MINOR.PATCH`). Voir `docs/VERSIONING.md`.

## Données — 2026-08-25 (correction v4, atelier famille — mise à jour du tableur, tables/noms uniquement)

### Quatrième correction du plan de table (nouvelle mise à jour du tableur)
- Nouvelle mise à jour du même Google Sheet appliquée par-dessus l'état des 243 invitations du lot v3. Demande explicite de Gersom : se baser sur ce tableur pour les tables/noms, garder la même logique qu'avant pour téléphone/tags/côté.
- Avant : 243 invitations, 382 personnes prévues. Après : 243 invitations, 382 personnes prévues, 11 sans table (compte inchangé — une ligne « reliquat » vidée compense la suppression d'un doublon). Aucune table au-dessus de la capacité de 10.
- **Conflit Brady Landu définitivement résolu par la famille dans le sens inverse de l'hypothèse retenue aux lots v2/v3** : le tableur ne le liste plus qu'une seule fois, à la table 26 (Staff/Sécurité) — la ligne table 30 a été supprimée. Corrigé : Brady Landu est donc en table 26 (SERVICES, Staff, Sécurité), et non plus table 30 comme dans les lots précédents.
- Vérification : comparaison automatisée champ par champ contre le jeu de données reconstruit — correspondance parfaite sur les 243 lignes. Sauvegarde `import_backups` confirmée (243 invitations, état juste avant ce lot).
- CSV format With Joy régénéré avec les tags `T0XX` (numéro de table courant) restaurés dans la colonne Tags — retirés par erreur lors de la correction du modèle d'import (voir entrée suivante), remis sur demande explicite de Gersom : « si quelqu'un était dans la table 39, mais maintenant est dans la table 13, j'attends T013 au lieu de T039 dans les tags ».
- Aucun changement de code applicatif — réimport de données uniquement.

## Données — 2026-08-25 (correction v3, atelier famille — mise à jour du tableur)

### Troisième correction du plan de table (même atelier, tableur remis à jour par Gersom)
- Nouvelle mise à jour du même Google Sheet (« mis a jours ») appliquée par-dessus l'état des 241 invitations du lot v2.
- Avant : 241 invitations, 380 personnes prévues. Après : 243 invitations, 382 personnes prévues, 11 sans table. Aucune table au-dessus de la capacité de 10.
- **Denise Landu et Rémy Landu sont de retour**, cette fois en « Sans table » avec catégorie Staff — ce qui clarifie leur statut du lot v2 (ils n'avaient pas été retirés intentionnellement, seulement déplacés hors tableau temporairement). Leur téléphone/email d'origine ont été restaurés depuis l'historique.
- **Conflit Brady Landu confirmé côté famille** : le tableur porte désormais explicitement la catégorie Staff sur la ligne table 30 (absente au lot v2, où elle avait été déduite). Le doublon table 26/Staff-Sécurité persiste dans le tableur — toujours résolu en ne gardant que la ligne table 30 (catégorie Staff conservée), comme au lot v2.
- **Côté de Jael Kippo confirmé** : le tableur indique désormais explicitement « Gege » (déduit par défaut au lot v2, maintenant renseigné par la famille elle-même).
- Vérification : comparaison automatisée champ par champ — correspondance parfaite sur les 243 lignes. Sauvegarde `import_backups` confirmée (241 invitations, état juste avant ce lot).
- Le CSV au format With Joy des lots précédents est désormais dépassé de deux corrections — à régénérer avant tout réimport dans With Joy.
- Aucun changement de code applicatif — réimport de données uniquement.

## Données — 2026-08-25 (correction v2, atelier famille — mise à jour du tableur)

### Deuxième correction du plan de table (même atelier, tableur remis à jour par Gersom)
- Le Google Sheet de l'atelier famille (même lien, `gid=2119594618`) a été remis à jour par Gersom après le premier réimport (« mis a jours ») ; ce lot applique les changements de cette nouvelle version par-dessus l'état des 242 invitations du lot précédent.
- Avant : 242 invitations, 381 personnes prévues. Après : 241 invitations, 380 personnes prévues, 9 sans table. Aucune table au-dessus de la capacité de 10.
- **Conflit « Hadelin Yezi » (table 1 / table 4) confirmé résolu** : la ligne table 4 a été vidée par la famille dans le tableur mis à jour — confirme que l'interprétation retenue au lot précédent (reliquat à ignorer, table 1 = table du cortège) était correcte.
- **Jael Kippo réapparaît**, table 26, sans côté renseigné dans le tableur — son côté (Gege) et son téléphone/email (récupérés dans l'historique d'avant le premier réimport, puisqu'elle avait totalement disparu de l'état intermédiaire à 242 lignes) ont été restaurés.
- **Denise Landu et Rémy Landu ont disparu du tableur** (auparavant table 30) — rejoignent Dylan Landu et Abigail Ferreira sur la liste des personnes retirées. **À confirmer avec Gersom si volontaire.**
- **Nouveau conflit détecté et résolu** : « Brady Landu » listé deux fois (table 26, catégorie Staff/Sécurité — et table 30, sans catégorie, aux côtés de Victoria Landu qui y a été déplacée proprement). Interprété comme un déplacement vers la table 30 avec perte accidentelle de la catégorie Staff/Sécurité lors de la recopie — la ligne table 26 a été ignorée et la catégorie Staff a été conservée sur la ligne table 30. **À confirmer avec Gersom.**
- « Vieux Richard Landu » renommé « Richard Landu » dans le tableur (même personne, table inchangée).
- **6 téléphones communiqués par Gersom en message** appliqués : Lina Kumpesa (+33 6 14 64 24 00), Guillaume Mayimakanda (+33 7 60 60 86 50), Esmeralda Vemba (même numéro que Helder Vemba) ont reçu un téléphone ; Tchecka Mbulu et Estelle Okito partageaient déjà le numéro de la personne citée dans leur propre invitation (aucune action nécessaire) ; Suzie Vemba reste sans téléphone (aucune donnée communiquée).
- Méthode identique au lot précédent (correspondance par nom, avec repli sur l'état pré-atelier à 235 lignes pour les personnes temporairement absentes de l'état à 242 lignes, afin de ne pas perdre leurs coordonnées historiques), même discipline d'écriture (verrou, contrôle de concurrence par empreinte, sauvegarde dans `import_backups`, vérification du nombre inséré, journal d'audit `import_withjoy_replace` avec `source: 'family_workshop_google_sheet_v2'`).
- Vérification : comparaison automatisée champ par champ contre le jeu de données reconstruit — correspondance parfaite sur les 241 lignes. Sauvegarde `import_backups` confirmée (242 invitations, état juste avant ce lot).
- Le CSV au format With Joy de la correction précédente est désormais dépassé d'une correction — à régénérer avant tout réimport dans With Joy.
- Aucun changement de code applicatif — réimport de données uniquement.

## Données — 2026-08-25 (correction complète, atelier famille via Google Sheet)

### Correction complète du plan de table (source : atelier famille)
- Remplacement complet des invitations à partir du Google Sheet corrigé par la famille lors d'un atelier de réorganisation (export de `Plan_de_tables_Nelly_Gersom.xlsx` envoyé le 24/08, réédité dans Google Sheets par Gersom), avec autorisation explicite (« update everything, update and correct a superbase if you need to »).
- **Changement de source de vérité** : à partir de ce lot, With Joy n'est plus la source de vérité pour les tables/placements — la famille corrige directement le tableur (table, invitation, personnes, côté), et Supabase est mis à jour depuis ce tableur. With Joy reste utilisé uniquement comme répertoire de contact (téléphone/email), backfillé par correspondance de nom lors de cette correction. Voir `docs/DATA_CHANGE_INSTRUCTIONS.md` section 6 pour la procédure mise à jour.
- Avant : 235 invitations, 387 personnes prévues. Après : 242 invitations, 381 personnes prévues, 233 avec table, 9 Staff/notable sans table, 0 arrivée (statut test, aucune conséquence sur du vrai check-in).
- **Table 1 devient la table du cortège** (demoiselles et garçons d'honneur) : 7 personnes extraites individuellement de leurs groupes familiaux d'origine (Lys Landu, Erika Dos Goncalves, Jean-Clivens Le Caous, Deborah Yezi, Hadelin Yezi, Herve Menga, Domingas Ferreira — cette dernière sortie du groupe « Famille Ferreira »).
- **Conflit détecté et résolu** : « Hadelin Yezi » apparaissait deux fois dans le tableur (table 1 et table 4, à côté de « Famille Yezi »). Interprété comme un reliquat de l'ancienne affectation non supprimé lors de l'extraction vers la table 1 — la ligne table 4 a été ignorée. **À confirmer avec Gersom.**
- **Personnes disparues du tableur par rapport à l'état précédent** (absentes de toute table ou du « sans table ») : Dylan Landu, Abigail Ferreira (un des 6 membres de l'ancienne « Famille Ferreira »), Jael Kippo. Ne figurent plus nulle part dans le tableur — à confirmer si volontaire (retrait de la liste) ou oubli.
- **6 personnes sans téléphone/email de secours** (nouvelles dans le tableur ou renommées sans correspondance trouvée dans l'historique With Joy) : Tchecka Mbulu, Suzie Vemba, Lina (« Tia Lina »), Guillaume Mayimakanda, Esmeralda Vemba (« Bana Vemba »), Estelle Okito (« Bana Okito »).
- **1 anomalie de donnée reportée telle quelle** : une ligne « Accompagnant non-nommé » sans nom ni tag (déjà signalée lors du réimport `guestlist_27.csv`) reste présente, toujours sans table.
- Aucune table ne dépasse la capacité de 10 ; 39 tables sur 41 utilisées (aucune personne sur la réserve).
- Méthode : correspondance par nom entre le tableur et l'état précédent pour recomposer chaque invitation (numéro de table, regroupement, nombre de personnes depuis le tableur ; téléphone, email et étiquettes de rôle staff — dont les étiquettes de zone `Photographe`/`DJ_Animation`/`Bar`/`Traiteur` utilisées par `/plan-table` — récupérées par correspondance individuelle avec l'historique). Écriture avec la même discipline que `admin_replace_invitations` (verrou de l'événement, contrôle de concurrence par empreinte, sauvegarde transactionnelle dans `import_backups`, vérification du nombre inséré, journal d'audit).
- Vérification : comparaison automatisée champ par champ (nom, groupe, nombre prévu, téléphone, email, notes, tags, côté, catégorie, statut de placement, numéro de table) contre le jeu de données reconstruit — correspondance parfaite sur les 242 lignes.
- Un CSV au format With Joy (`tags, envelope name, first name, last name, phone number, email, ..., party, rsvp`) a été généré pour réimporter cette correction dans With Joy (contacts uniquement) — RSVP repris de l'historique quand disponible, sinon supposé confirmé par défaut (à vérifier).
- Aucun changement de code applicatif — réimport de données uniquement.

## Données — 2026-08-24 (réimport complet, guestlist_27.csv)

### Réimport complet de la liste d'invités
- Remplacement complet des invitations de l'événement « Mariage Nelly & Gersom » à partir de `guestlist_27.csv`, avec autorisation explicite de Gersom (« met a jours avec ce data a jours svp »).
- Méthode : même pipeline validé que les réimports précédents (`lib/withjoyImport.ts`, déjà testé par `tests/withjoy-import.test.ts`) pour préparer et valider les invitations, puis écriture en base avec la même discipline que la RPC `admin_replace_invitations` (verrou de l'événement, contrôle de concurrence par comptage + empreinte, sauvegarde transactionnelle complète dans `import_backups` (RLS déjà active), suppression puis réinsertion, vérification du nombre inséré, journal d'audit `import_withjoy_replace`).
- Avant : 232 invitations, 386 personnes prévues, 0 arrivée, 0 « ne viendra pas ».
- Après : 235 invitations, 389 personnes prévues, 227 avec table, 8 Staff/notable sans table, 0 arrivée, 0 « ne viendra pas ».
- **Aucun conflit et aucune personne disparue** : diff automatisé (par nom, multiset) entre l'ancien état et le nouveau montre uniquement 3 ajouts, 0 suppression — Alegria Mpilingi et Dylan Landu (nouveaux invités, table 40, sans tag de table explicite dans le CSV) et une ligne « Accompagnant non-nommé » (1 personne, `RSVP: Sans réponse`, aucun tag) correspondant à une ligne totalement vide côté With Joy (aucun nom, aucun tag) — anomalie de la source à signaler à Gersom, pas une erreur du script.
- **Personnes sans table en dehors des `notable` habituels : aucune.** Les 8 sans-table sont Genevieve Bila (tag `notable`, toujours sans affectation manuelle comme anticipé par Gersom le 23/08/2026 : « elle n'aura pas de table de toute facon ») et les 7 mêmes prestataires `notable` (photographes, DJ/animation) déjà signalés lors du réimport `0026`/vérification précédente.
- Vérification : comparaison automatisée champ par champ (nom, groupe, nombre prévu, téléphone, email, notes, tags, côté, catégorie, statut de placement, numéro de table) contre le JSON source vérifié — correspondance parfaite sur les 235 lignes.
- RLS de `import_backups` confirmée active après l'opération ; `import_backups` contient désormais 1 sauvegarde (l'état des 232 invitations précédentes), toujours illisible par `anon`/`authenticated`.
- Advisors Supabase sans problème critique après l'opération (mêmes notes `INFO` déjà connues, RLS-sans-policy sur les tables de sauvegarde).
- Aucun changement de code applicatif — réimport de données uniquement.

## [1.15.3] — 2026-08-24

### Corrigé
- `components/FloorPlan.tsx` : correction de l'emplacement des tables 34, 35, 36 et 37 sur le plan interactif (`/plan-table`). L'ordre visuel de haut en bas dans cette colonne était 36/35/34/37 ; corrigé en 37/36/35/34 pour correspondre à l'agencement réel de la salle, confirmé par Gersom après relecture du rendu de l'app (« la correction est au niveau de l'emplacement des tables 34,35,36 et 37 »). Aucun changement de numérotation des invités ni de données Supabase — uniquement les coordonnées `[x, y]` de ces 4 tables dans `FLOOR_PLAN_TABLE_POSITIONS`. La table 16 reste inchangée (confirmée correcte).

### Tests
- `npx tsc --noEmit`, `npm run test:floorplan` (13/13) et `npm run build` réexécutés avec succès après la correction des positions.

## [1.15.2] — 2026-08-23

### Sécurité et permissions
- Nouvelle capacité dédiée `callStaff` dans `lib/permissions.ts`, réservée à admin et directeur. Signalé par Gersom : le bouton d'appel direct (📞) sur `/staff` et sur le panneau « personnel d'une zone » de `/plan-table` ne doit être utilisable que par le directeur de festin (et admin) — les autres rôles (placeur, agent scan, visibilité) n'ont pas besoin d'appeler qui que ce soit.
- `app/staff/page.tsx` et `app/plan-table/page.tsx` : le bouton 📞 (`tel:`) n'est désormais rendu que si `hasCapability(role, 'callStaff')`, en plus de la présence d'un numéro de téléphone. Aucun autre changement de comportement (les lignes restent visibles et cliquables pour le check-in selon `checkin`, inchangé).

### Corrigé
- `/scan` retravaillé pour tenir sur un seul écran sans défilement, y compris sur les petits téléphones (ex. iPhone SE) : caméra passée d'un ratio carré à 3/2 (moins haute, toujours fonctionnelle pour le scan — `html5-qrcode` dimensionne la vidéo sur le conteneur quel que soit son ratio), titres et espacements resserrés. Demande explicite de Gersom : « arrange-toi pour que ça soit tous dans une page sans qu'on ait besoin de défiler ».
- Le composant `components/QrScanner.tsx` est partagé avec `/placement` : la caméra y est légèrement plus petite aussi, sans changement de comportement.

### Documentation
- Synchronisation avec l'état vérifié de la migration `0026_import_replace_invitations` (PR #36 puis correctif PR #37, déjà fusionnées dans `main` avant ce lot) : `docs/BUSINESS_RULES.md` et `docs/DATA_CHANGE_INSTRUCTIONS.md` désignent désormais `/admin/import-withjoy` et la RPC `admin_replace_invitations` comme le chemin de référence pour un futur réimport complet, plutôt que la transcription manuelle de SQL utilisée pour les réimports `guestlist_*` de cette même journée. `docs/QE_QA_PROCESS.md` documente la leçon retenue : dans ce projet Supabase, `pgcrypto` est installé dans le schéma `extensions` (jamais dans le `search_path` sécurisé des RPC) — tout futur appel à `digest()`/`gen_random_uuid()` etc. dans une fonction doit le qualifier explicitement (`extensions.digest(...)`), pour éviter l'échec transactionnel rencontré lors de la première tentative d'application de la migration 0026 (annulée entièrement sans aucun impact, avant correctif).
- État vérifié directement en production le 23/08/2026 après la fusion de la PR #37 (aucune écriture Supabase faite par Claude dans ce lot, uniquement des lectures de contrôle) : migration `0026_import_replace_invitations` enregistrée; table `import_backups` avec RLS active et 0 sauvegarde; fonctions `admin_import_invitations_state`/`admin_replace_invitations` accessibles uniquement à `service_role` (aucun droit `anon`/`authenticated`); données inchangées (232 invitations, 386 personnes prévues, 0 arrivée); empreinte de concurrence `fbb00be4d0e53b64f7d594accdb0b5016bd50185a0ff9f576254385c34944f0d` confirmée identique à celle rapportée; advisors Supabase sans problème critique (seules des notes `INFO` déjà connues : RLS sans policy sur les tables de sauvegarde, clés étrangères non indexées sur `import_backups`).

### Tests
- Nouveau test : `callStaff` est réservé à admin/directeur (placeur, agent scan et visibilité ne l'ont pas), et les deux pages utilisent bien `hasCapability(role, 'callStaff')` pour garder le bouton d'appel.
- `npx tsc --noEmit`, `npm run test:roles` (14/14), `npm run test:withjoy` (6/6), `npm run test:members` (3/3), `npm run test:floorplan` (13/13), `npm run test:diffusion` (5/5), `python3 -m unittest tests.test_import_scripts` (11/11) et `npm run build` exécutés avec succès.

## [1.15.1] — 2026-08-23

### Corrigé
- La migration `0026_import_replace_invitations.sql` qualifie désormais `extensions.digest`, car `pgcrypto` est installé dans le schéma `extensions` du projet Supabase et n'est volontairement pas inclus dans le `search_path` sécurisé des RPC.
- La première tentative d'application a échoué transactionnellement avant toute création; aucune donnée ni aucun objet de schéma n'a été modifié.

## [1.15.0] — 2026-08-23

### Ajouté
- Nouvel écran admin `/admin/import-withjoy` : lecture locale d'un export CSV With Joy, aperçu complet du placement puis remplacement atomique des invitations après double confirmation.
- Port TypeScript des règles d'import validées : tags `Txxx`/`Fxxx`, RSVP déclinés, individuation du staff, exclusion du cortège, tags `notable`/`Needs_Table_*`, débordement vers le pool puis la réserve et blocage si la capacité totale est dépassée.
- Migration `0026_import_replace_invitations.sql` : sauvegarde privée complète avant remplacement et journal d'audit avec identifiant de sauvegarde.

### Sécurité
- Route et écran réservés à l'admin. L'import réel est interdit en mode `live`/`closed`, exige la saisie `REMPLACER`, recalcule le CSV côté serveur et refuse toute liste modifiée depuis l'aperçu.
- Les sauvegardes contenant des données personnelles ne sont accessibles ni à `public`, ni à `anon`, ni à `authenticated`; seule la `service_role` serveur peut utiliser la RPC.
- L'import est bloqué si une personne reste non placée, si une table manque ou si la capacité est dépassée. Aucun import n'a été exécuté sur Supabase dans ce lot.

### Tests
- Ajoute `tests/withjoy-import.test.ts` pour le CSV, les règles staff/cortège/sans-table, les RSVP, les tags F/T, la saturation et les protections SQL/API.

## [1.14.0] — 2026-08-23

### Ajouté
- Les listes détaillées du tableau de bord affichent désormais le nombre de personnes réparti entre côté Nelly et côté Gégé, comme le plan de table.
- Le décompte s'adapte à la catégorie consultée : personnes arrivées, restantes, supplémentaires ou prévues selon la liste.

### Tests
- `npm run test:roles`, `npx tsc --noEmit` et `npm run build`.
- Aucune migration ni écriture Supabase.

## Données — 2026-08-23 (réimport complet, guestlist_25.csv)

### Réimport complet de la liste d'invités
- Remplacement complet des invitations de l'événement « Mariage Nelly & Gersom » à partir de `guestlist_25.csv`, avec autorisation explicite de Gersom (« Même chose, voici le dossier à jour, tu as tous les droits pour faire toutes les modifications nécessaires »).
- Sauvegarde préalable : `invitations_backup_20260823_v25`, avec RLS activé immédiatement dans la même migration.
- Avant : 233 invitations, 386 personnes prévues, 0 arrivée réelle, 0 « ne viendra pas ».
- Après : 232 invitations, 386 personnes prévues, 224 avec table, 8 Staff sans table, 0 arrivée, 0 « ne viendra pas ».
- **Aucun conflit** : le double-tag de Henry Kiadi Ndiongo (T015/T025, signalé lors des deux réimports précédents) est résolu à la source — il est désormais fusionné dans « Famille Kiadi Ndiongo » (avec Sumali Ndiongo) avec un seul tag `T025`, placé table 25. Aucun débordement de capacité cette fois (0 invitation redistribuée).
- **Aucune personne sans table en dehors des `notable` habituels** : Mika Fleurival (signalée lors du réimport précédent comme en attente d'affectation) a désormais une table assignée par Gege (table 12, tag `T012` au lieu de `Needs_Table_Gege`).
- Vérification : comparaison automatisée champ par champ (nom, groupe, nombre prévu, téléphone, catégorie, côté, tags, statut de placement) et numéro de table, contre le JSON source vérifié — correspondance parfaite sur les 232 lignes, aucune ligne fabriquée ni manquante.
- RLS de `invitations_backup_20260823_v25` confirmé actif (`pg_class.relrowsecurity = true`) directement après la migration.
- Aucun changement de code applicatif — réimport de données uniquement.

## Données — 2026-08-23 (réimport complet, guestlist_24.csv)

### Réimport complet de la liste d'invités
- Remplacement complet des invitations de l'événement « Mariage Nelly & Gersom » à partir de `guestlist_24.csv`, avec autorisation explicite de Gersom (« MET A JOURS AVEC CETTE SOURCE... corrige tout et écrase à partir de cette source »).
- Sauvegarde préalable : `invitations_backup_20260823_v24`, avec RLS activé immédiatement dans la même migration.
- Avant : 234 invitations, 387 personnes prévues, 0 arrivée réelle, 0 « ne viendra pas ».
- Après : 233 invitations, 386 personnes prévues, 224 avec table, 9 Staff sans table, 0 arrivée, 0 « ne viendra pas ».
- Conflit signalé : Henry Kiadi Ndiongo porte toujours à la fois `T015` et `T025` dans `guestlist_24.csv` (même conflit que lors du réimport précédent) ; placé table 15 (premier tag, règle déjà appliquée).
- Débordement de capacité sur une table explicitement taguée : Famille Bitumazala (T015, 4 personnes) redistribuée vers la table la moins remplie sans étiquette (23).
- Sans table en dehors des `notable` habituels : **Mika Fleurival** (tags `Bar`, `Needs_Table_Gege`) — Gege ne lui a pas encore assigné de table à la main (même traitement que `notable` par règle métier existante, voir `docs/BUSINESS_RULES.md`), signalé explicitement comme demandé.
- Genevieve Bila porte désormais le tag `notable` dans cette source (elle n'a plus de table, contrairement au réimport précédent) — cohérent avec ce que Gersom avait annoncé.
- Vérification : comparaison automatisée champ par champ (nom, groupe, nombre prévu, téléphone, catégorie, côté, tags, statut de placement) et numéro de table, contre le JSON source vérifié — correspondance parfaite sur les 233 lignes, aucune ligne fabriquée ni manquante. Cas particuliers revérifiés individuellement par requête nominative après écriture.
- RLS de `invitations_backup_20260823_v24` confirmé actif (`pg_class.relrowsecurity = true`) directement après la migration.
- Aucun changement de code applicatif — réimport de données uniquement.

## [1.13.0] — 2026-08-23

### Ajouté
- Nouvel écran admin `/admin/diffusion` pour préparer l'envoi personnalisé des invitations à partir d'un fichier Excel ou CSV. Le premier onglet est lu localement dans le navigateur, avec association automatique ou manuelle des colonnes (famille, téléphone, email, code d'invitation, nombre de personnes, langue, canal, statut et notes).
- Génération stricte du lien Canva depuis un code explicite `T010`/`F004` (`https://libalz.my.canva.site/vol-t010`), sans déduction fragile depuis un numéro de table. Aperçu du message avec variables, copie, ouverture manuelle de WhatsApp ou de l'email, filtres de suivi et marquage « Envoyé ».
- Réexport `.xlsx` du suivi complet, incluant coordonnées, code, lien Canva, statut, erreurs, notes et message généré.

### Sécurité
- Écran réservé à l'admin par le middleware existant. Aucune API et aucune écriture Supabase : les contacts et le suivi restent uniquement en mémoire dans l'onglet et disparaissent au rechargement, sauf réexport volontaire par l'admin.
- Aucun envoi automatique. Un nom ou un code Canva invalide désactive les raccourcis WhatsApp/email et le marquage d'envoi; les téléphones/emails invalides sont signalés ligne par ligne.

### Tests
- Ajoute `tests/invitation-diffusion.test.ts` : génération stricte des URL Canva, association des en-têtes Excel, validation sans déduction de table, personnalisation du message et encodage du lien WhatsApp.

## [1.12.0] — 2026-08-23

### Ajouté
- Mise à jour du plan de salle interactif de `/plan-table` à partir d'une photo annotée à la main envoyée par Gersom : numérotation et disposition des tables 22-41 ajustées (reconstruction raisonnable à partir de la photo, approximative comme le plan d'origine — pas une trace pixel par pixel), et deux nouvelles zones ajoutées par split de zones existantes : « Zone enfants » + « Prestataires & staff » (ex-Stockage), « Piste de danse » (réduite) + « Stage band & chanteurs » (ex-Piste de danse).
- **La table de réserve (41) a désormais une position définie sur le plan**, confirmé explicitement par Gersom — jusqu'ici elle en était volontairement absente (emplacement physique non défini, voir v1.10.0). Elle est maintenant cliquable comme les tables 1-40, et sa carte dans la liste habituelle reçoit elle aussi le bouton 📍 « localiser sur le plan ».
- Certaines zones du plan (Cuisine, Bar, DJ et animation, Prestataires & staff) sont cliquables : elles affichent en dessous du plan le personnel de catégorie `Staff` portant le tag correspondant (`Traiteur`, `Bar`, `DJ_Animation`, `Photographe`) — noms, statut de table, bouton d'appel direct. Ces tags sont déjà posés sur les invitations depuis l'import CSV (voir `scripts/build_plan_from_csv.py`) : aucune migration ni changement de données n'a été nécessaire, uniquement un filtrage côté client sur les invitations déjà chargées. Demande explicite de Gersom : « quand on clique sur les différentes zones, ça puisse nous amener sur les personnes, incluant les gens du staff ».
- Sélectionner une zone efface la table sélectionnée et inversement — un seul panneau (table ou zone) s'affiche sous le plan à la fois, dans la continuité de la logique déjà en place pour la sélection de table.
- Les autres zones (Zone enfants, Piste de danse, Stage band & chanteurs, couloirs, buffets, vin d'honneur…) restent de simples repères visuels non cliquables, faute de tag dédié en base pour l'instant.

### Non fait (sur demande explicite de Gersom)
- Genevieve Bila (tag `Traiteur`) a actuellement une table assignée en production — Gersom a précisé que le prochain réimport CSV la passera sans table, donc aucune modification manuelle de production n'a été faite ici (voir `docs/DATA_CHANGE_INSTRUCTIONS.md` : jamais de modification de données sans autorisation explicite et ciblée). Le clic sur la zone Cuisine l'affiche déjà via son tag `Traiteur`, qu'elle ait une table ou non.

### Tests
- `tests/floor-plan.test.ts` étendu (13/13, contre 10/10 en v1.11.0) : couverture des 41 positions (1 à 40 plus la réserve), la carte de réserve reçoit bien `onLocate`, les quatre zones cliquables portent le bon tag, sélectionner une table efface la zone sélectionnée et inversement, le filtrage du personnel d'une zone se fait bien sur les invitations déjà chargées (aucun nouvel appel réseau). Un vrai bug de test préexistant a été corrigé au passage : l'ancien test de non-régression sur la réserve ciblait par erreur la première occurrence de `reserve.map` dans le fichier (`new Set(reserve.map(...))`, sans rapport avec le rendu JSX) au lieu de l'appel JSX réel — il passait donc pour la mauvaise raison depuis v1.10.0; ancrage corrigé sur `{reserve.map((t) => (`.
- Vérification visuelle : rendu du plan mis à jour exporté en HTML statique et capturé via Chromium headless (même technique que v1.10.0, sans dépendre d'un environnement Supabase) — confirme l'absence de chevauchement entre les nouvelles zones scindées et la nouvelle colonne de tables.
- `npx tsc --noEmit`, `npm run test:roles` (13/13), `npm run test:members` (3/3), `npm run test:floorplan` (13/13), `python3 -m unittest tests.test_import_scripts` (11/11) et `npm run build` exécutés avec succès.

## [1.11.0] — 2026-08-23

### Ajouté
- Le plan de salle interactif de `/plan-table` se zoome désormais : pincement à deux doigts sur écran tactile (jusqu'à ×3), ou boutons +/− (et ↺ pour réinitialiser une fois zoomé) pour les appareils sans tactile. Signalé par Gersom : le plan était trop petit pour distinguer une table d'un coup d'œil quand on veut appeler quelqu'un rapidement.
- Nouveau composant `components/ZoomableFloorPlan.tsx`, qui enrobe `FloorPlan` (le SVG du plan lui-même est inchangé) avec un zoom/déplacement tactile en Pointer Events, sans dépendance externe. `touch-action: none` reste scopé au cadre du plan uniquement — le zoom natif du reste de la page n'est jamais désactivé.
- Le déplacement (pan) à un doigt une fois zoomé reste borné pour ne jamais laisser un bord vide apparaître dans le cadre. Refermer puis rouvrir le plan réinitialise le zoom à 100 % (le composant est démonté avec le bloc replié, son état interne repart donc à zéro à chaque réouverture).
- Relâcher un pincement ou un glissement au-dessus d'une table ne déclenche jamais sa sélection par accident (`onClickCapture` supprime le clic qui suit un mouvement au-delà d'un seuil). Chaque nouveau geste réinitialise proprement cette garde lorsqu'aucun clic synthétique n'a été produit, afin que le prochain vrai tap ne soit jamais ignoré; une distance initiale minimale protège aussi le calcul du pincement contre une division par zéro.

### Tests
- `npm run test:floorplan` étendu (10/10) : la page utilise bien le plan zoomable et non le plan brut directement; les bornes de zoom (`MIN_SCALE`/`MAX_SCALE`) et le scope de `touch-action: none` sont vérifiés par inspection du code source; la garde anti-clic-accidentel après pincement/glissement est vérifiée.
- `npx tsc --noEmit`, `npm run test:roles` (13/13), `npm run test:members` (3/3), `npm run test:floorplan` (10/10), `python3 -m unittest tests.test_import_scripts` (11/11) et `npm run build` exécutés avec succès.

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
