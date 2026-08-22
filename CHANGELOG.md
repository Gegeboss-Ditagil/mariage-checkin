# Changelog

Toutes les évolutions fonctionnelles significatives de l'application sont consignées ici.
Le projet suit Semantic Versioning (`MAJOR.MINOR.PATCH`). Voir `docs/VERSIONING.md`.

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
