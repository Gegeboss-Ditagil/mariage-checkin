# Check-in Mariage Nelly & Gersom

**Version actuelle : 1.29.5**
**Dernière mise à jour documentaire : 2026-09-01**

[![Dernier commit](https://img.shields.io/github/last-commit/Gegeboss-Ditagil/mariage-checkin/main?label=derni%C3%A8re%20mise%20%C3%A0%20jour)](https://github.com/Gegeboss-Ditagil/mariage-checkin/commits/main)
[![Branche de production](https://img.shields.io/badge/production-main-success)](https://github.com/Gegeboss-Ditagil/mariage-checkin/tree/main)
[![Version](https://img.shields.io/badge/version-1.29.5-blue)](package.json)
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

- Branche de production : `main`; version proposée par cette PR : **1.29.5**.
- Le socle v1.29.4 est en production via la PR #53. Cette PR v1.29.5 corrige l'utilisation de toute la largeur en paysage sur iPhone/iPad, sans modifier les règles métier ni Supabase.
- Supabase Production : la migration `0038_strict_guest_approval_assignment.sql` est **déjà appliquée et vérifiée**. La fonction `assign_table_to_guest_approval_strict` existe en mode `INVOKER`; le fichier SQL reste dans le dépôt pour garantir l'historique.
- Ne jamais appliquer un ancien diff aveuglément : récupérer `origin/main`, comparer les fichiers réels et conserver tout changement plus récent.
- Les permissions sont centralisées dans `lib/permissions.ts`; les capacités doivent être vérifiées à la fois dans l'interface et dans chaque route API.
- Les prochaines livraisons doivent utiliser une branche et une Pull Request afin que Gersom puisse réviser avant fusion.
- Instructions détaillées de reprise : `CLAUDE.md`.

## État fonctionnel v1.29.5

- Sur `/scan`, `admin`, `placeur` et `directeur` prennent la photo d'un invité surprise directement depuis le flux vidéo déjà ouvert, sans lancer l'app Caméra. Un grand bouton Approbations placé au-dessus de la jauge d'arrivées affiche le nombre de demandes en attente ; Approbations reste aussi dans le menu du compte, jamais dans la barre basse.
- La caméra de `/scan` occupe maintenant une hauteur proportionnelle à l'écran, bornée de 340 à 680 px, au lieu du petit ratio horizontal 3/2 qui l'écrasait sur les grands iPhone. La vidéo remplit la zone sans déformation et le cadre QR s'adapte à la surface réellement disponible.
- `/agenda` donne à l'admin et au directeur un chronogramme mobile du jour J. Les responsables, shifts, départements définitifs et validations « fait » restent volontairement à attribuer jusqu'à réception des informations complètes.
- Dans `/approbations`, toucher une demande ouvre sa photo en grand avec le côté et les boutons Approuver/Refuser. Deux flèches permettent de traiter la demande précédente/suivante sans fermer la fenêtre. Après approbation, l'approbateur peut voir les tables recommandées (places réellement libres, places provisoires non arrivées, réserve) ou laisser le placeur décider ; par SMS/WhatsApp, la réponse reste limitée à Oui/Non. Si la table est pleine, le placement impose d'abord de déplacer des groupes non arrivés vers une destination ayant assez de capacité, dans la même transaction.
- Les alertes d'approbation fonctionnent immédiatement dans l'application avec un badge et une bannière actualisés toutes les 5 secondes. Les placeurs peuvent s'abonner aux notifications sans obtenir le droit d'approuver. Pour recevoir un véritable Push iPhone quand l'application est fermée, configurer `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` dans Vercel ; cela ne nécessite aucune nouvelle migration SQL après `0037`/`0038`.
- Pour les comptes `admin` et `visibilite`, la flèche Retour des écrans opérationnels ramène toujours au tableau de bord.
- En paysage sur iPhone ou iPad, l'application utilise maintenant toute la largeur de l'écran au lieu de rester enfermée dans une colonne mobile avec des bandes latérales ; la navigation devient une bande verticale fixée au bord droit.
- Sur le tableau de bord, la flèche Retour mène à l'accueil pour les administrateurs et directeurs de festin ; sur les autres écrans, la règle de retour contextuelle existante reste inchangée.

- **RLS activée sur `public.user_credential_backups`** : table exposée (RLS désactivée) signalée par l'advisor de sécurité Supabase, jamais utilisée par cette application — corrigée, même posture que les autres tables sensibles du dépôt (`users`, `audit_logs`, `import_backups` : RLS activée, aucune policy, accès réservé à `service_role`).
- **Invité surprise avec approbation SMS/WhatsApp à distance** : depuis `/scan`, un placeur/directeur/admin peut photographier un invité non prévu, choisir son côté (Nelly/Gégé) et envoyer une demande d'approbation par SMS **et WhatsApp** au parent concerné (lien vers une page publique avec la photo — jamais de MMS) avant de le laisser entrer. L'approbateur peut cliquer le lien ou répondre directement « Oui »/« Non » au message WhatsApp. Une fois approuvée (`/approbations`), l'assignation de table reste manuelle. Suivi automatique : places de réserve restantes à l'approbateur, rapport complet au directeur de festin.
- **Barre de navigation « verre liquide »** : pilule flottante en verre dépoli, icônes plus grandes et libellés inactifs mieux contrastés — l'ancienne barre plate était jugée difficile à voir. En orientation paysage (téléphone tourné, ou iPad), elle bascule en bande verticale fixée au bord droit de l'écran ; le contenu de la page défile normalement de haut en bas, indépendamment de la barre.
- **Bande d'information de base sur `/scan`** : nombre d'invités arrivés/attendus et une jauge compacte du remplissage de la salle, juste au-dessus de la barre de navigation — ouvre le tableau de bord complet au tap.
- **Historique (`/history`) réservé à l'admin** : les autres rôles (directeur, placeur, agent scan) n'y ont plus accès.
- **Déplacer une personne seule vers une autre table** : depuis « Qui est arrivé ? », un bouton ⇄ par personne (réservé aux rôles avec la capacité de déplacer) la détache de son groupe et crée une fiche à une seule personne à la table choisie — pour la regrouper avec une invitation déjà présente à cette table, utiliser ensuite « Fusionner avec un autre groupe » depuis la nouvelle fiche.
- **Bouton central de la barre de navigation adapté au rôle** : Scan pour la plupart des rôles, mais Tableau de bord pour le directeur de festin — son travail commence par surveiller le remplissage, pas par scanner des QR (toujours accessible en onglet latéral).
- **« + Invité supplémentaire (non prévu) » ajoute maintenant une personne nommée** (visible avec ✓/✕ dans « Qui est arrivé ? »), tout en gardant le déclenchement de l'assignation à une table de réserve en cas de dépassement de capacité — plus un simple compteur anonyme.
- **Renommer et ajouter directement depuis la fiche** : taper le nom d'une personne dans « Qui est arrivé ? » le modifie sur place (comme le titre de la fiche) ; un bouton « + » ajoute une personne au groupe sans passer par « Gérer les membres du groupe » — réservé aux rôles avec la capacité de gérer les membres.
- **Thème « Atrium » (clair) / « Maison » (sombre)**, choisi une seule fois à la première connexion puis modifiable à tout moment (menu du compte), avec un mode « Automatique » qui suit le réglage clair/sombre de l'appareil en direct. Toutes les pages en profitent, y compris `/login`.
- **Arrivée par personne** sur les fiches de groupe : un bouton ✓/✕ par personne nommée (jamais un simple compteur global), toujours réversible, place libérée sans jamais supprimer la personne.
- **Barre de navigation à 5 icônes** adaptée au rôle : l'admin garde Scan directement, le directeur remplace Staff par Agenda et conserve Tableau de bord au centre ; sur `/scan`, le grand bouton central devient la prise de photo. En portrait la pilule et ses cibles sont plus hautes ; en paysage elle devient une bande verticale au bord droit.
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
- Les écrans abonnés au temps réel regroupent (debounce) une rafale d'événements — utile lors d'un réimport CSV ou d'une correction en lot — pour rester rapides avec une vingtaine de personnes connectées en même temps au lieu de multiplier les requêtes en parallèle.
- `app/global-error.tsx` ajoute un filet de secours si le layout racine lui-même plante, en plus de `app/error.tsx`.
- Le sélecteur de fichier de `/admin/import-withjoy` accepte plusieurs alias MIME pour rester utilisable depuis le sélecteur « Parcourir » de Safari iOS après un téléchargement sur iPhone.
- Un déplacement de table ou un renommage fait par un autre agent pendant qu'une fiche `/checkin/[invitationId]` (ou sa sous-page membres) reste ouverte se reflète maintenant sans rechargement manuel.
- L'import With Joy détecte désormais les personnes dupliquées dans un même groupe et ne classe plus `Cortège`/`Need_Contact`/`Mail` comme un rôle de staff ; les lignes totalement sans nom sont comptées et signalées dans l'aperçu.
- La recherche de `/plan-table` trouve désormais aussi un invité par son prénom au sein d'un couple/groupe (ex. « Karl » dans « Couple Isolokele »), et affiche les prénoms des membres sous le nom du groupe — comme le faisaient déjà `/search`, `/staff` et les fiches table.
- La liste des tables de `/plan-table` rappelle maintenant explicitement le mode de tri actif (numéro ou places libres) juste au-dessus des cartes, pour éviter de croire l'ordre incohérent quand les boutons « Trier par… » sont remontés hors de l'écran.
- `placement_status` (« Confirmée »/« Provisoire ») reflète désormais la confiance RSVP plutôt que le fait que la table vienne d'un tag CSV explicite ou de l'algorithme.
- Sur `/plan-table`, une paire de barres est devenue une seule barre de progression compacte (capacité/prévu/présence, rouge en cas de dépassement) — même principe repris sur chaque carte de table. Les filtres côté Nelly/Gégé et confirmées/provisoires vivent dans une rangée de pastilles dédiée, près des boutons de tri (état actif net, fond plein) ; les tuiles de statistiques restent un simple affichage mais reflètent désormais le filtre actif.
- Sur `/checkin/[invitationId]`, libérer une place dans « Qui ne vient pas dans ce groupe ? » propose désormais un bouton « ↩️ Annuler » ; « Cet invité ne viendra pas » se cache quand ce panneau par-membre prend déjà le relais, mais reste disponible pour une invitation seule ou pour annuler un marquage déjà posé.
- Les listes détaillées du dashboard (`/dashboard/liste`, invités restants/arrivés/tous/…) ont désormais un filtre par côté et un filtre « Staff » (même pastilles dédiées que `/plan-table`) : les tuiles personnes/côté Nelly/côté Gégé reflètent le filtre actif.

## Sessions et mises à jour

- Durée maximale d'une session : **12 heures**.
- Les sessions sont liées au déploiement courant; après un nouveau déploiement, une ancienne session est invalidée à la prochaine requête protégée.
- Le middleware supprime les anciens cookies et renvoie vers `/login`.
- Le service worker ne sert pas les assets Next.js `/_next/*` depuis un ancien cache.
- En cas d'erreur client de version/chunk, l'application tente un logout puis revient au login au lieu de rester sur une page blanche.
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

Voir `CHANGELOG.md` pour le détail de **v1.29.5** et l'historique des versions.
