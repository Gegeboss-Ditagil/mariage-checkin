# Check-in Mariage Nelly & Gersom

**Version actuelle : 1.15.1**
**Dernière mise à jour documentaire : 2026-08-23**

[![Dernier commit](https://img.shields.io/github/last-commit/Gegeboss-Ditagil/mariage-checkin/main?label=derni%C3%A8re%20mise%20%C3%A0%20jour)](https://github.com/Gegeboss-Ditagil/mariage-checkin/commits/main)
[![Branche de production](https://img.shields.io/badge/production-main-success)](https://github.com/Gegeboss-Ditagil/mariage-checkin/tree/main)
[![Version](https://img.shields.io/badge/version-1.15.1-blue)](package.json)
[![Application](https://img.shields.io/badge/application-en%20ligne-0070f3)](https://mariage-checkin.vercel.app/)

Application PWA de check-in pour le mariage du **24 octobre 2026**.

## Source de vérité rapide

Avant toute modification, lire :

1. `package.json` — version applicative courante.
2. `CHANGELOG.md` — changements par version.
3. `docs/VERSIONING.md` — règles de bump et de release.
4. `CLAUDE.md` — ordre de lecture pour Claude et les agents IA.
5. `docs/BUSINESS_RULES.md` — règles métier et permissions.
6. `docs/DATA_AND_FORMS.md` — données, formulaires et Supabase.
7. `docs/DATA_CHANGE_INSTRUCTIONS.md` — procédure pour toute écriture en production.
8. `docs/QA_SCENARIOS.md` — contrôles avant merge.
9. `DEPLOIEMENT.md` — déploiement et récupération après mise à jour.
10. `ASSIGNATION_TABLES.md` — logique et état du plan de table.

## État fonctionnel v1.15.1

- **41 tables au total**.
- **Diffusion privée des invitations** : l'admin peut importer un Excel local, préparer les liens Canva et les messages WhatsApp/email, puis réexporter le suivi sans enregistrer les coordonnées sur le serveur.
- **Tables 1 à 40 : normales**.
- **Table 41 : seule table de réserve**.
- **Capacité officielle : 400 places**.
- **Capacité absolue avec réserve : 410 places**.
- Les tables 38, 39 et 40 sont des tables normales et gardent leurs occupants existants.
- `/plan-table` affiche la capacité officielle sur 400 places.
- Les cartes du plan de table ouvrent le détail de chaque table.
- Le plan de salle interactif de `/plan-table` se zoome (pincement à deux doigts ou boutons +/−) pour distinguer les tables d'un coup d'œil, notamment pour appeler quelqu'un rapidement.

## Sessions et mises à jour

- Durée maximale d'une session : **12 heures**.
- Les sessions sont liées au déploiement courant; après un nouveau déploiement, une ancienne session est invalidée à la prochaine requête protégée.
- Le middleware supprime les anciens cookies et renvoie vers `/login`.
- Le service worker ne sert pas les assets Next.js `/_next/*` depuis un ancien cache.
- En cas d'erreur client de version/chunk, l'application tente un logout puis revient au login au lieu de rester sur une page blanche.
- Le navigateur peut toujours mémoriser le nom/PIN grâce aux champs `autocomplete` du formulaire de connexion.

## Fonctionnalités principales

- Connexion par nom + PIN.
- Scan QR et recherche d'invités.
- Suivi séparé des arrivées du staff via `/staff` et QR spécial `STAFF`.
- Check-in, correction et annulation selon permissions.
- Gestion des tables, déplacements et débordements.
- Plan de table temps réel.
- Dashboard, historique, exceptions et exports.
- Gestion optionnelle des membres d'un groupe.
- Rôles : Admin, Directeur de festin, Agent placeur, Agent scan, Visibilité.

Les permissions sont centralisées dans `lib/permissions.ts`; les contrôles serveur restent obligatoires même si un bouton est masqué dans l'interface.

## Stack

- Next.js 14 App Router + TypeScript + Tailwind CSS.
- Supabase/Postgres comme backend.
- PWA installable avec service worker.
- Vercel pour la production.

## Structure du projet

```text
app/                 pages et routes App Router
app/api/             routes API
components/          composants partagés
hooks/               hooks React
lib/                 auth, permissions, Supabase, types
public/              manifest, service worker, icônes
supabase/migrations/ migrations SQL versionnées
docs/                documentation métier, QA, données, versioning
scripts/             scripts d'import / maintenance
```

## Règle de versioning obligatoire

Le projet suit Semantic Versioning (`MAJOR.MINOR.PATCH`).

Toute PR qui modifie le comportement de production doit préciser :

- `Version: X.Y.Z → A.B.C` ou `Version inchangée: X.Y.Z` ;
- le contenu fonctionnel du changement ;
- les migrations éventuelles ;
- les tests exécutés ;
- les documents mis à jour.

Si une PR déclenche une release, mettre à jour **dans le même lot** :

- `package.json` ;
- `CHANGELOG.md` ;
- tous les documents concernés ;
- les tests ou scénarios QA concernés.

Aucun document de référence ne doit conserver une ancienne règle (ex. 370 places / 37+3 tables) après une release qui l'a remplacée.

## Données et production

Supabase est la source de vérité opérationnelle. Toute modification manuelle de production doit être :

1. autorisée explicitement ;
2. prévisualisée ;
3. réversible ;
4. vérifiée avant/après ;
5. reportée dans une migration GitHub ;
6. documentée dans la version correspondante.

Voir `docs/DATA_CHANGE_INSTRUCTIONS.md` pour la procédure complète.

## Release actuelle

Voir `CHANGELOG.md` pour le détail de **v1.15.1** et l'historique des versions.
