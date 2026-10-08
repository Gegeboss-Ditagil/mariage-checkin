# Check-in Mariage Nelly & Gersom

**Version actuelle : 1.72.1**
**Dernière mise à jour documentaire : 2026-10-07**

[![Dernier commit](https://img.shields.io/github/last-commit/Gegeboss-Ditagil/mariage-checkin/main?label=derni%C3%A8re%20mise%20%C3%A0%20jour)](https://github.com/Gegeboss-Ditagil/mariage-checkin/commits/main)
[![Branche de production](https://img.shields.io/badge/production-main-success)](https://github.com/Gegeboss-Ditagil/mariage-checkin/tree/main)
[![Version](https://img.shields.io/badge/version-1.72.1-blue)](package.json)
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

## Transmission rapide à Claude AI

Voir la section **« Reprise rapide pour Claude AI »** à la fin de `CLAUDE.md` — maintenue à jour à chaque version, c'est la seule source de vérité pour ce point d'entrée (ce README ne duplique plus ces faits volatils, source d'un vrai bug documenté en v1.66.1 : les deux copies avaient fini par diverger silencieusement sur plus de dix versions).

- Les permissions sont centralisées dans `lib/permissions.ts`; les capacités doivent être vérifiées à la fois dans l'interface et dans chaque route API.
- Toute livraison utilise une branche et une Pull Request dédiées (une demande distincte = une PR distincte, voir `CLAUDE.md`) afin que Gersom puisse réviser avant fusion.

## État actuel

Voir `CHANGELOG.md` pour l'historique complet et détaillé, version par version — c'est la seule source de vérité tenue à jour à chaque release pour « qu'est-ce qui a changé et quand ». Quelques repères structurels toujours vrais aujourd'hui :

- **42 tables actives** (depuis le 07/10/2026, v1.72.0, migration `0066`) : tables 2 à 41 normales (capacité 10 chacune, **400 places officielles**), **tables 1 « Maquela do Zombo » et 42 = réserves « excédentaires »** (vides, 420 places absolues). Détail complet : `ASSIGNATION_TABLES.md`.
- **Temps réel (Supabase Realtime)** sur les écrans principaux (`/dashboard`, `/plan-table`, `/exceptions`, fiches de table), avec application du delta plutôt qu'un refetch complet à chaque mise à jour.
- **Invité surprise avec approbation à distance** (`/scan` → `/approbations`), placement automatique à l'approbation, réservation de table possible avant décision.
- **Agenda partagé** (`/agenda`, admin/directeur), avec éléments privés et responsables assignables (comptes ou noms libres).
- **Thème Atrium (clair) / Maison (sombre)**, au choix, avec un mode Automatique qui suit le réglage de l'appareil.
- **PWA installable**, service worker, numéro de version visible sur le splash et sur `/login`.

## Sessions et mises à jour

- Durée maximale d'une session : **12 heures**.
- **(Corrigé en v1.53.19)** Un déploiement n'invalide plus une session active — seule l'expiration naturelle (12 h) ou un changement réel du format du payload de session (`SESSION_SCHEMA_VERSION`, incrémentée à la main) la termine. Avant cette version, chaque déploiement Vercel déconnectait instantanément toutes les sessions actives à la prochaine requête protégée — c'était la cause principale d'un signalement de déconnexions fréquentes.
- Le middleware ne nettoie les cookies de session que sur une vraie navigation sans session valide (jamais sur un simple préchargement Next.js) avant de renvoyer vers `/login`.
- Le service worker ne sert pas les assets Next.js `/_next/*` depuis un ancien cache.
- En cas de vraie erreur de bundle périmé (`ChunkLoadError` après un déploiement), l'application reconnecte proprement plutôt que de rester sur une page blanche — toute autre erreur de rendu affiche un écran récupérable sans jamais toucher à la session.
- Le navigateur peut toujours mémoriser le nom/PIN grâce aux champs `autocomplete` du formulaire de connexion.

## Fonctionnalités principales

- Connexion par nom + PIN, thème Atrium/Maison (clair/sombre/auto) au choix.
- Scan QR et recherche d'invités.
- Arrivée par personne pour les groupes (✓/✕ par membre nommé, jamais un simple compteur).
- Suivi séparé des arrivées du staff via `/staff` et QR spécial `STAFF`.
- Check-in, correction et annulation selon permissions.
- Gestion des tables, déplacements et débordements.
- Plan de table temps réel.
- Dashboard, historique, exceptions et exports.
- Gestion optionnelle des membres d'un groupe.
- Rôles : Admin, Directeur de festin, Agent placeur, Agent scanner, Approbateur.

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

Voir `CHANGELOG.md` pour le détail de la version courante (`package.json`) et l'historique complet des versions précédentes.
