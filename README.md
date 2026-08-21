# Check-in Mariage Nelly & Gersom

[![Dernier commit](https://img.shields.io/github/last-commit/Gegeboss-Ditagil/mariage-checkin/main?label=derni%C3%A8re%20mise%20%C3%A0%20jour)](https://github.com/Gegeboss-Ditagil/mariage-checkin/commits/main)
[![Branche de production](https://img.shields.io/badge/production-main-success)](https://github.com/Gegeboss-Ditagil/mariage-checkin/tree/main)
[![Application](https://img.shields.io/badge/application-en%20ligne-0070f3)](https://mariage-checkin.vercel.app/)

Application de check-in pour le mariage — **24 octobre 2026**.
PWA (installable sur téléphone, avec un bouton "Installer l'app" sur l'écran de connexion),
fonctionne avec connexion requise pour valider une entrée.

> **Documentation vivante :** les badges ci-dessus suivent automatiquement la branche `main` et son dernier commit. À chaque changement fonctionnel, le même commit doit aussi ajuster les sections concernées de ce README (rôles, parcours, données ou exploitation) afin que la documentation reste alignée avec l'application déployée.

Documentation de référence pour les développeurs, QA et agents IA :

- [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md) : matrice officielle des cinq rôles et règles métier.
- [`docs/QA_SCENARIOS.md`](docs/QA_SCENARIOS.md) : parcours à tester avant chaque push.
- [`docs/DATA_AND_FORMS.md`](docs/DATA_AND_FORMS.md) : règles Supabase, Google Sheets, imports et formulaires.
- [`CLAUDE.md`](CLAUDE.md) : ordre de lecture obligatoire pour Claude Code et les autres agents IA.

393 invités / 195 invitations (foyers, familles, groupes) répartis sur 40 tables (37 officielles + 3 de réserve), déjà importés et placés dans la base réelle. Cible actuelle : 370 places officielles; le surplus reste identifié dans les tables de réserve pendant le nettoyage de la liste.

## 1. C'est quoi, concrètement

- Les hôtes/hôtesses scannent le QR code sur la table de l'invité (ou cherchent son nom), voient qui est attendu, et cochent les personnes présentes au fur et à mesure.
- Un tableau de bord suit en direct : arrivés / attendus / tables pleines / débordements, avec une jauge visuelle colorée (vert/jaune/rouge) du remplissage de la salle et de chaque table.
- Les débordements (plus de monde que prévu à une table) sont assignés à n'importe quelle table (pas seulement les tables de réserve) — et peuvent être retirés ou déplacés vers une autre table à tout moment par les rôles qui peuvent modifier les tables.
- N'importe quelle invitation (famille/groupe) peut être déplacée d'une table à une autre directement dans l'app, en cas de réorganisation avant ou pendant l'événement.
- Une invitation peut être marquée "ne viendra pas" pour libérer ses places prévues dans les estimations de capacité (elle se démarque automatiquement si le groupe se présente quand même).
- Recherche par nom, mais aussi par téléphone (avec sélecteur de pays) ou email, accessible depuis le bouton « Rechercher un invité » — utile si quelqu'un n'a plus de batterie ou que son nom est mal orthographié.
- Par défaut, tout est granulaire par invitation (foyer), pas par invité individuel — pour rester simple et rapide le jour J. Mais il est possible, groupe par groupe et seulement si besoin, de détailler la liste des membres d'une invitation pour retirer ou nommer une personne précise sans toucher au reste du groupe (voir section 7).
- Tout se met à jour en temps réel entre les téléphones connectés : plusieurs agents peuvent travailler en même temps sur les mêmes tables sans se marcher dessus (voir section 8).
- Sur le tableau de bord et la liste des tables, tirer l'écran vers le bas relance un rafraîchissement léger. Les données sont aussi relues automatiquement quand l'application revient au premier plan.
- Le bouton « Plan de table » est présenté dans l'écran Tables. Les rôles autorisés à scanner peuvent revenir directement au Scan depuis le plan de table et le tableau de bord; le rôle Visibilité reste dans son parcours en lecture seule.
- L'écran Recherche affiche la liste alphabétique complète des invitations avant toute saisie. Chaque groupe peut être déplié pour consulter ses tags et ses membres; l'ouverture du check-in reste réservée aux rôles autorisés.

## 2. Rôles

Tout le monde se connecte de la même façon : **nom affiché + code PIN à 4 chiffres**. Il n'y a plus de mot de passe/email pour personne, y compris les admins.

| Rôle | Connexion | Peut faire |
|---|---|---|
| Admin | nom + code PIN | Tout : configuration, tables, invitations, imports/exports, mode test, comptes équipe |
| Directeur de festin | nom + code PIN | Même accès opérationnel complet qu'un agent placeur (scan, check-in, modifier/déplacer les tables, dashboard), mais jamais le panneau admin (imports/exports/mode test/gestion des comptes) |
| Agent placeur | nom + code PIN | Scanner, chercher, cocher les arrivées, modifier/déplacer les tables, gérer les débordements, dashboard |
| Agent scan | nom + code PIN | Scanner / rechercher, cocher les arrivées, assigner un débordement au moment du check-in — ne peut pas déplacer un invité déjà assis ni réorganiser un débordement déjà affecté après coup |
| Visibilité | nom + code PIN | Lecture seule : dashboard (avec jauges de remplissage), tables, recherche — jamais de scan ni de modification |

Comptes déjà créés dans la base réelle. Chaque personne a son propre nom + PIN (pour savoir qui a fait quoi le jour J). Les PIN peuvent être changés à tout moment par un admin depuis `/admin/users` (renommer, changer le PIN ou le mot de passe, activer/désactiver).

### Admins (2)

| Nom (à taper tel quel) | PIN |
|---|---|
| Admin | 2245 |
| Dos | 4654 |

### Directeurs de festin (3)

| Nom | PIN |
|---|---|
| Remy | 1914 |
| Tuzola | 2013 |
| Sem Landu | 2015 |

### Agent placeur — la mariée (1)

| Nom | PIN |
|---|---|
| Nelly Dos | 2014 |

### Visibilité — lecture seule (2)

| Nom | PIN |
|---|---|
| Luis | 4792 |
| David | 8560 |

### Staff — agents placeurs (13 nommés + 3 en réserve)

| Nom | PIN | | Nom | PIN |
|---|---|---|---|---|
| Wandubula | 4168 | | Ribeiro | 9631 |
| Shungu | 0462 | | Muzezenu | 5349 |
| Shampe | 4932 | | Onokoko | 1944 |
| Lotisi | 0205 | | Placeur014 (réserve) | 4014 |
| Damuna | 2821 | | Placeur015 (réserve) | 4015 |
| Kambwa | 5558 | | Placeur016 (réserve) | 4016 |
| Luyindula | 9012 | | | |
| Lopez | 6622 | | | |
| Landu | 0624 | | | |
| Sanda | 2648 | | | |

### Agents scan (16, comptes génériques en réserve)

| Nom | PIN | | Nom | PIN |
|---|---|---|---|---|
| Agent001 | 3001 | | Agent009 | 3009 |
| Agent002 | 3002 | | Agent010 | 3010 |
| Agent003 | 3003 | | Agent011 | 3011 |
| Agent004 | 3004 | | Agent012 | 3012 |
| Agent005 | 3005 | | Agent013 | 3013 |
| Agent006 | 3006 | | Agent014 | 3014 |
| Agent007 | 3007 | | Agent015 | 3015 |
| Agent008 | 3008 | | Agent016 | 3016 |

Renommez-les depuis `/admin/users` (bouton "Modifier") au fur et à mesure que vous confirmez d'autres membres de l'équipe, exactement comme pour les agents placeurs ci-dessus.

Astuce pour le jour J : imprimez/partagez chaque ligne uniquement à la personne concernée (ex: une photo du tableau découpée), plutôt que la liste complète, pour limiter les risques si un téléphone est perdu. Les anciens comptes de test (`Agent Test 1`, `Placeur Test`) sont désactivés.

## 3. Stack technique

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + API) comme backend — région eu-west-1 (Irlande) ; la latence réseau avec Paris est négligeable (~15-25 ms)
- PWA : manifest + service worker (installable, écran d'accueil, mode hors-ligne pour la consultation ; **toute validation d'arrivée nécessite une connexion internet**, par choix — pour éviter les doublons/désynchronisations entre plusieurs téléphones)

## 4. Structure du projet

```
app/                 pages (App Router) : login, scan, search, tables, tables/[id],
                      tables/move/[invitationId], tables/overflow/[assignmentId],
                      table/[id], checkin/[invitationId], checkin/[invitationId]/members,
                      dashboard, placement, exceptions, history,
                      admin/* (wizard, tables, import, qr, users, exports)
app/api/              routes API (auth, checkin, export, admin/*, overflow/*,
                      move-invitation, members/*, exceptions, history, invitations/no-show)
lib/                  clients Supabase, session, exports, types, capacité (lib/capacity.ts)
components/           composants partagés (TopBar avec déconnexion, QrScanner,
                      InstallAppButton, BrandMotif, CapacityGauge, etc.)
hooks/                hooks (useOnline, useSessionRole)
supabase/migrations/  schéma SQL de la base
public/               manifest PWA, service worker, icônes
scripts/              scripts ponctuels utilisés pour importer les vraies données
                      et générer l'assignation des tables (voir section 6)
```

Note : dans le workspace de travail utilisé pour développer l'application, les mêmes fichiers vivent sous `src/` (convention Next.js habituelle) — mais ce dépôt GitHub n'a pas de dossier `src/`, tout est à la racine comme indiqué ci-dessus.

## 5. Configuration (`.env.local`)

Copier `.env.example` en `.env.local` et remplir :

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SESSION_SECRET=...
NEXT_PUBLIC_EVENT_NAME="Mariage Nelly & Gersom"
```

Ce projet est déjà connecté au projet Supabase réel (`znqxmmrtvmhsfsnphjcv`) avec les vraies données importées — voir `DEPLOIEMENT.md` pour les récupérer si besoin.

## 6. Données réelles déjà en base

- **195 invitations / 393 personnes** importées depuis l'export With Joy `guestlist_8.csv`, en excluant les RSVP explicitement déclinés.
- **40 tables** réelles : 7 tables familiales + 30 tables de soirée (370 places officielles), puis 3 tables de réserve.
- Chaque invitation possède un côté (Nelly, Gégé ou neutre) et un statut de placement : confirmé depuis un label With Joy ou provisoire.
- **`/plan-table`** affiche en direct les occupants, leur côté et leur statut de placement; l'écran est accessible depuis Tables.
- **Assignation des tables** déjà effectuée pour les 195 invitations (voir `ASSIGNATION_TABLES.md`).
- Colonnes téléphone/email disponibles sur les invitations (recherche floue par numéro, suffixe de 5 chiffres minimum) mais pas encore remplies dans l'import actuel — réimportez via `/admin/import` avec les colonnes Téléphone/Email si besoin de cette fonctionnalité.

Les scripts dans `scripts/` (`gen_real_seed.py`, `assign_tables.py`, `pack_tables.py`, etc.) documentent comment ces données ont été générées à partir du CSV — ils ne sont pas nécessaires pour faire tourner l'application, gardez-les pour référence ou pour un futur ré-import via `/admin/import`.

## 7. Gestion des membres individuels (optionnel)

Depuis l'écran de check-in d'un groupe, le lien "Gérer les membres du groupe" permet, si besoin :

- de retirer une seule personne d'un groupe (ex: retirer "Marie" d'une famille de 4) sans toucher aux autres — le nombre de personnes prévues du groupe s'ajuste automatiquement ;
- de nommer une personne qui n'a pas encore de prénom/nom connu ;
- d'ajouter quelqu'un au groupe.

La première fois qu'on ouvre cet écran pour un groupe, l'app propose une liste pré-remplie à partir du texte importé — à vérifier avant d'enregistrer, certaines familles ont des doublons ou des écarts dans les données importées d'origine. C'est entièrement optionnel : tant que personne n'ouvre cet écran pour un groupe, tout continue à fonctionner comme avant (par invitation entière).

## 8. Plusieurs agents en même temps

L'app est conçue pour que 15-20 agents travaillent en même temps sans erreurs :

- chaque action d'écriture (check-in, correction, débordement, déplacement de table, membres) passe par une fonction en base de données qui verrouille la ligne concernée — jamais de double-comptage même si deux agents valident la même invitation à la même seconde ;
- les écrans partagés (tableau de bord, liste des tables, détail d'une table, membres d'un groupe) se mettent à jour tout seuls en temps réel dès qu'un agent fait une action ;
- si deux agents tombent sur la même action au même moment (ex: la même personne excédentaire), celui qui arrive en second reçoit un message clair plutôt qu'une erreur technique.

Tout ça dépend malgré tout d'internet : vérifiez la qualité du WiFi sur place avant le jour J, et prévoyez la 4G/5G en secours sur les téléphones de l'équipe.

## 9. Utilisation le jour J

1. Chaque hôte/hôtesse se connecte sur son téléphone (nom + PIN).
2. Scan du QR sur la table, ou recherche par nom / table / téléphone / email.
3. Coche les personnes présentes → décompte mis à jour en direct partout.
4. En cas de surplus à une table, assignation depuis l'écran de check-in — retirable ou déplaçable ensuite par les rôles admin/directeur/placeur. L'écran `/placement` sert uniquement à retrouver rapidement un numéro de table.
5. En cas de réorganisation, une invitation entière peut être déplacée vers une autre table depuis l'écran de la table (bouton ⇄, visible pour les rôles qui peuvent modifier).
6. L'admin/directeur suit tout depuis `/dashboard` (avec jauges de remplissage) et peut exporter les listes (arrivés, absents, partiels, supplémentaires, répartition, réserve) en CSV/XLSX depuis `/admin/exports`.

## 10. Documents liés

- `DEPLOIEMENT.md` — comment mettre l'application en ligne (Vercel) et la connecter à Supabase.
- `ASSIGNATION_TABLES.md` — détail de la méthode utilisée pour placer les invitations sur les 40 tables, et l'état actuel des réserves.

