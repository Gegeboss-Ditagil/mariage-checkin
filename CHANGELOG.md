# Changelog

Toutes les évolutions fonctionnelles significatives de l'application sont consignées ici.
Le projet suit Semantic Versioning (`MAJOR.MINOR.PATCH`). Voir `docs/VERSIONING.md`.

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
