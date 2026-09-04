# Check-in Mariage Nelly & Gersom

**Version actuelle : 1.41.3**
**Dernière mise à jour documentaire : 2026-09-04**

[![Dernier commit](https://img.shields.io/github/last-commit/Gegeboss-Ditagil/mariage-checkin/main?label=derni%C3%A8re%20mise%20%C3%A0%20jour)](https://github.com/Gegeboss-Ditagil/mariage-checkin/commits/main)
[![Branche de production](https://img.shields.io/badge/production-main-success)](https://github.com/Gegeboss-Ditagil/mariage-checkin/tree/main)
[![Version](https://img.shields.io/badge/version-1.41.3-blue)](package.json)
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

- Branche de production : `main`; version proposée : **1.41.3**.
- Le socle v1.29.5 est en production. v1.30.0 corrige la navigation contextuelle Dashboard/Scan et ajoute l’agenda partagé.
- Supabase Production : les migrations `0038_strict_guest_approval_assignment.sql` et **`0049_force_assign_guest_approval.sql`** sont **déjà appliquées et vérifiées**. La fonction `assign_table_to_guest_approval_strict` existe en mode `INVOKER` (avec le paramètre `p_force boolean default false` ajouté par 0049) ; les fichiers SQL restent dans le dépôt pour garantir l'historique.
- **Migrations 0043, 0044 (v1.33.0), 0045, 0046 (v1.34.0/v1.35.0) et 0049 (v1.41.0) appliquées en production** : `custom_assignees` sur `agenda_items`, `reserved_table_id`/`linked_invitation_id` + les RPC `reserve_table_for_guest_approval`/`release_guest_approval_reservation`/`auto_assign_table_for_guest_approval` sur `guest_approval_requests`, et `p_force boolean default false` ajouté à `assign_table_to_guest_approval_strict` (0049). Vérifié après coup : les colonnes et les fonctions (`SECURITY INVOKER`) existent bien en base.
- Ne jamais appliquer un ancien diff aveuglément : récupérer `origin/main`, comparer les fichiers réels et conserver tout changement plus récent.
- Les permissions sont centralisées dans `lib/permissions.ts`; les capacités doivent être vérifiées à la fois dans l'interface et dans chaque route API.
- Les prochaines livraisons doivent utiliser une branche et une Pull Request afin que Gersom puisse réviser avant fusion.
- Instructions détaillées de reprise : `CLAUDE.md`.

## État fonctionnel v1.41.0

Cette version ajoute le **forçage d'assignation d'un invité surprise sur une table pleine** (migration `0049`) et corrige un test de régression de navigation. **Migration Supabase à appliquer : `0049_force_assign_guest_approval.sql`.**

### Temps réel : le delta au lieu du refetch complet
- **Un check-in ne re-télécharge plus toute la table.** Chaque check-in est un `UPDATE` d'une seule ligne d'`invitations` ; le payload Realtime (~1 Ko) contenait déjà la ligne, mais chaque écran relançait un `select('*')` complet (~100–300 Ko) — multiplié par chaque tablette ouverte sur l'écran. Désormais la ligne est appliquée localement via `applyRowDelta` (`lib/realtimeDelta.ts`, nouveau) sur `/dashboard`, `/plan-table`, `/exceptions`, `/tables/[tableId]` (et l'ancienne route `/table/[tableId]`) ainsi que le panneau « Qui est arrivé ? ».
- **INSERT/DELETE restent debouncés à 400 ms** (rares : réimport CSV) — `lib/debounce.ts` regroupe les rafales en un seul rechargement.
- **Le panneau « Qui est arrivé ? » filtre sa souscription `guests` localement** (la table n'est pas filtrable par `invitation_id` côté serveur : le lien vit dans `invitation_guests`) via les ids déjà listés, avec debounce 300 ms — une édition d'un invité d'une *autre* invitation ne recharge plus le panneau.

### Polling et connexions
- **`hooks/usePolling.ts` (nouveau)** : le `setInterval` est suspendu sur `visibilitychange` (téléphone verrouillé, PWA en arrière-plan) et repris au retour au premier plan. Adopté par `AccountMenu` (5 s), `GuestApprovalsShortcut` (5 s), `BottomNav` (15 s), `NextAgendaActivity`, `/staff` (10 s), `/agenda` (10 s) et `/approbations` (10 s) — des dizaines de requêtes inutiles par minute en moins avec ~20 appareils.
- **Client Supabase navigateur en singleton par onglet** (`lib/supabase/client.ts`) : il était recréé à chaque `load()`, dupliquant l'état Realtime et les websockets ; il n'y a plus qu'une instance partagée et les canaux ne se dupliquent plus.

### Chargements différés
- **`/search`** : le dataset complet n'est plus fetché au simple montage de la page — seulement quand l'agent bascule en mode « parcourir toutes les invitations » (mode nom sans saisie), avec des colonnes réduites à ce que la liste affiche.
- **`/tables/move-multiple`** : une seule requête `Promise.all` (invitations + tables + affectations excédentaires) au lieu de deux fetches séquentiels — la sélection n'est qu'un sous-ensemble du dataset complet dont `computeTableCapacities` a besoin.
- **`xlsx` (~450 Ko) en import dynamique** sur `/admin/import` et `/admin/diffusion` : la bibliothèque n'est chargée que lorsqu'un fichier est réellement ouvert, plus dans le bundle initial de ces pages.
- **`poweredByHeader: false`** dans `next.config.js` (hygiène, en-tête retiré des réponses).

### Version visible
- **Numéro de version affiché sur le splash** (badge « v1.40.0 » en bas à droite) : `app/page.tsx` lit `package.json` au build et le passe à `SplashScreen` — plus de doute sur la version réellement déployée.

### Conventions à respecter pour les prochaines pages
- Toute nouvelle souscription temps réel doit appliquer `applyRowDelta` pour les `UPDATE` (chemin chaud) et débouncer `INSERT`/`DELETE` (400 ms).
- Tout nouveau sondage doit passer par `usePolling` — jamais de `setInterval` brut ; `createClient()` peut être appelé librement, le singleton garantit une instance unique par onglet.
- Nouveaux tests : `tests/realtime-delta.test.ts` et `tests/use-polling.test.ts`. Deux assertions périmées de `tests/guest-approvals.test.ts` et `tests/agenda-form.test.ts` ont été alignées sur la source (elles échouaient déjà sur `main` avant ces changements).
- Validation : **22/22 fichiers de tests passent** (`node --test`) et `tsc --noEmit` ne signale aucune erreur.

- Le flash de navigation entre deux fiches d'une même route dynamique (deux tables, deux invités) a disparu : chaque page réinitialise son état avant de recharger, au lieu d'afficher brièvement l'ancien contenu.
- Sur `/agenda`, les raccourcis latéraux `Agenda` et `Bord` sont inversés pour conserver la position habituelle de l'agenda; `/dashboard` et `/scan` restent inchangés.
- La création d'une activité permet maintenant de choisir ses responsables dès la modale « Nouvelle activité », avec le même picker de recherche que la modification.
- **`/agenda` : sélecteur de responsables en recherche plein écran**, à la place de la longue liste de cases à cocher — l'équipe s'affiche par défaut, et à partir de 2 caractères la recherche porte aussi sur les invités (pour assigner quelqu'un du cortège aidant à la dernière minute), sans jamais charger toute la liste des invités d'un coup.
- **`+ Invité` en bouton rond en verre** (au lieu d'un simple lien texte), désormais présent aussi sur `/dashboard` au même endroit qu'`/plan-table` (coin supérieur droit, à côté du menu du compte) — réservé à `addInvitation` (admin/directeur uniquement).
- **`/admin/users` : bascule Actif/Désactivé en verre liquide** (thème iOS) et **possibilité de changer le rôle/accès d'un compte** directement depuis sa fiche d'édition — le nouvel identifiant (email+mot de passe ou PIN) est requis quand le rôle change, puisque le mode de connexion en dépend.
- **Invité surprise lié à un groupe déjà invité** : depuis `/checkin/[invitationId]`, un placeur/directeur/admin peut démarrer une demande d'approbation pour une personne arrivée avec le groupe affiché sur la fiche — côté préempli automatiquement, photo prise avec l'appareil natif, nom saisi, puis même circuit d'approbation que `/scan`. Le placement automatique priorise désormais la table de ce groupe avant même la table excédentaire. Coexiste avec le "+" de « Qui est arrivé ? » (ajout instantané sans photo, voir plus bas), tous deux réservés au même rôle — jamais `agent_checkin` : « si les scanners scannent, vous dites vous êtes quatre mais dans l'invitation il y a deux, ils ne vont même pas traiter votre demande... c'est les placeurs qui vont gérer le reste ».
- **Placement automatique à l'approbation** : approuver une demande n'exige plus de choisir une table au préalable — la personne est placée automatiquement (table excédentaire en priorité, sinon la table la plus libre du même côté, sinon de l'autre côté, sinon approuvée sans table si tout est plein). Le directeur de festin reste libre de la déplacer ensuite.
- **Approuver/Refuser directement sur la carte de la liste** `/approbations`, sans ouvrir la fiche détaillée.
- **Thème « verre liquide » (iOS Liquid Glass) appliqué aux surfaces partagées de toute l'application** (`.card`, lignes d'action, boutons) : flou + saturation + reflet intérieur + ombre flottante, dans les deux thèmes — la barre de navigation du bas avait déjà ce style, il manquait au reste des écrans.
- **`/agenda` ne plante plus si la migration `0043` (colonne `custom_assignees`) venait à manquer** (elle est désormais appliquée en production, voir plus haut) : l'API normalise ce champ en tableau et la page ajoute un filet côté client — le rendu sur une colonne manquante plantait auparavant toute la page (« Mise à jour de l'application », déconnexion forcée), donnant l'impression de déconnexions fréquentes.
- **Le badge de demandes en attente (avatar du compte, menu déroulant, barre du bas) est désormais réellement en temps réel** : la réponse `GET /api/guest-approvals?count=pending` était réutilisable depuis le cache HTTP du navigateur faute d'en-tête explicite, figeant le compte sur une ancienne valeur qui semblait « hard codée ».
- **`/dashboard` tient désormais sans avoir à défiler** jusqu'à la dernière table de réserve : espacements et cartes resserrés dans tout l'empilement, pas seulement en bas de page.
- **`/scan` affiche la prochaine activité du chronogramme** juste au-dessus du raccourci Approbations — s'appuie sur la case « terminé » de chaque activité (pas sur l'heure de l'appareil), réservé à admin/directeur, un tap ouvre l'agenda complet.
- **Réservation de table avant approbation** : depuis la fiche d'une demande encore en attente, un placeur/directeur/admin/visibilite peut désormais voir les tables disponibles et en réserver une tout de suite, sans attendre la décision — la place est comptée aussitôt (aucune autre demande en attente ne peut la prendre) mais aucune invitation n'est créée. Dès que la demande est approuvée, la réservation est automatiquement transformée en vraie assignation ; si elle est refusée, elle est simplement libérée. Corrige le double booking possible auparavant entre l'approbation et l'assignation manuelle.
- **Fiabilité des décisions Approuver/Refuser** : un double-appui rapide pouvait déclencher deux requêtes avant que le bouton ne se désactive, la seconde recevant à tort « déjà traitée » — verrouillage synchrone ajouté. Le message reflète désormais le statut réel renvoyé par le serveur (Approuvée/Refusée) plutôt qu'un texte générique.
- **Petit badge persistant sur l'avatar du compte** (pas seulement dans le menu déroulant) dès qu'une approbation est en attente, visible sur tous les écrans sans avoir à ouvrir le menu.
- **Agenda : responsable au nom libre** — en plus des comptes existants, la fiche de modification d'une activité permet d'ajouter un nom personnalisé (ex. un prestataire externe sans compte dans l'application).
- `/scan` n'affiche plus de bouton « Prendre une photo » sous la caméra, redondant avec le gros bouton central. `/dashboard` laisse plus d'espace en bas de la liste (la dernière carte était légèrement coupée sur iPhone).
- **Formulaires de l'agenda repris en style iOS** : le champ Heure utilise désormais la roue native (comme sur iPhone), avec une plage horaire optionnelle (ex. « 18:30–19:00 ») ; chaque libellé (Heure, Activité, Département, Détails) est correctement séparé de son champ — ils s'affichaient auparavant collés (« Heure08:00 ») car la classe de style du champ n'avait jamais été définie. Les deux pop-up (nouvelle activité, modifier) reçoivent un bouton de fermeture rond en verre, comme sur `/approbations`, et la liste des responsables une coche ronde personnalisée au lieu de la case à cocher par défaut du navigateur.
- **Corrections de navigation admin/directeur remontées par Rémy en test** : sur `/scan`, le bouton central redevenait « Tableau de bord » au lieu de rester l'appareil photo — corrigé, il reste toujours l'appareil photo sur cet écran. Approbations (déjà un gros bouton dédié juste au-dessus de la jauge) cède sa place dans la barre basse à Tableau de bord, désormais accessible en un tap depuis le scanner. Retour depuis `/dashboard` ouvre directement `/scan` pour tout rôle qui peut scanner (admin, directeur), au lieu de repasser par l'écran d'accueil (qui rebouclait vers le tableau de bord pour le directeur).
- **« + Ajouter un invité » ouvert au directeur de festin, avec table/étiquettes/téléphone** : le formulaire (accessible depuis `/plan-table`) capture désormais aussi le numéro de téléphone (avec indicatif du pays) et les étiquettes courantes (dont Staff — visible ensuite par tout le monde sur l'écran Staff), et choisit la table via le même sélecteur avec places libres que le reste de l'application. Corrige au passage un bug préexistant : le formulaire était déjà visible pour directeur/placeur mais la création échouait toujours côté serveur pour ces rôles (capacité manquante), sans lien pour le remarquer avant ce correctif.
- Sur `/scan`, `admin`, `placeur` et `directeur` prennent la photo d'un invité surprise directement depuis le flux vidéo déjà ouvert, sans lancer l'app Caméra. Un grand bouton Approbations placé au-dessus de la jauge d'arrivées affiche le nombre de demandes en attente ; Approbations reste aussi dans le menu du compte, jamais dans la barre basse.
- La caméra de `/scan` occupe maintenant une hauteur proportionnelle à l'écran, bornée de 340 à 680 px, au lieu du petit ratio horizontal 3/2 qui l'écrasait sur les grands iPhone. La vidéo remplit la zone sans déformation et le cadre QR s'adapte à la surface réellement disponible.
- `/agenda` donne à Gersom et aux directeurs un chronogramme partagé : ajout d’activités entre deux étapes, modification directe de l'heure/titre/département/détails, affectation de responsables, validation « terminé » et mise à jour pour les autres appareils. Nelly possède désormais le rôle complet `directeur`, comme Rémy; appliquer `0042_promote_nelly_directeur.sql` après les migrations précédentes.
- Les fiches d’arrivée utilisent une liste nominative avec ✓/X. La migration `0040` répare sans changer les totaux les anciennes invitations dont les lignes nominatives manquent. Un accompagnant non prévu doit être nommé puis passe directement au placement de l’excédent; il ne recommence pas le processus d’approbation.
- Dans `/approbations`, toucher une demande ouvre une fiche centrée dans l'écran : photo en grand, champs distincts Nom/Invités/Côté/Demandé par/Placement et boutons Approuver/Refuser. Un bouton X ferme clairement la fiche et deux grandes flèches flottantes en verre iOS passent à la demande précédente/suivante. Après approbation, le champ Placement devient cliquable : il ouvre une liste rapide contenant uniquement les tables ayant assez de places réellement libres, avec le nombre de places affiché et la table 41 prioritaire lorsqu'elle convient. Le résultat distingue « Approuvé — sans table » et « Approuvé — Table X »; par SMS/WhatsApp, la réponse reste limitée à Oui/Non.
- Les approbations profitent du splash de trois secondes pour précharger la liste et les six premières photos. Supabase signe les photos privées par lot et les nouvelles captures sont limitées à 1280 px/JPEG 80 % avant envoi : aucun forfait payant ni bucket public n'est nécessaire pour ce gain de vitesse.
- Les alertes d'approbation fonctionnent immédiatement dans l'application avec un badge et une bannière actualisés toutes les 5 secondes. Les placeurs peuvent s'abonner aux notifications sans obtenir le droit d'approuver. Pour recevoir un véritable Push iPhone quand l'application est fermée, configurer `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` dans Vercel ; cela ne nécessite aucune nouvelle migration SQL après `0037`/`0038`.
- Pour les comptes `admin` et `visibilite`, la flèche Retour des écrans opérationnels ramène toujours au tableau de bord.
- En paysage sur iPhone ou iPad, l'application utilise maintenant toute la largeur de l'écran au lieu de rester enfermée dans une colonne mobile avec des bandes latérales ; la navigation devient une bande verticale fixée au bord droit.
- Sur le tableau de bord, la flèche Retour mène à l'accueil pour les administrateurs et directeurs de festin ; sur les autres écrans, la règle de retour contextuelle existante reste inchangée.
- Les actions de sélection multiple « Transférer / Échanger » flottent maintenant au-dessus du bas de l'écran dans un dock en verre translucide façon iOS, plus facile à distinguer et à toucher.

- **RLS activée sur `public.user_credential_backups`** : table exposée (RLS désactivée) signalée par l'advisor de sécurité Supabase, jamais utilisée par cette application — corrigée, même posture que les autres tables sensibles du dépôt (`users`, `audit_logs`, `import_backups` : RLS activée, aucune policy, accès réservé à `service_role`).
- **Invité surprise avec approbation SMS/WhatsApp à distance** : depuis `/scan`, un placeur/directeur/admin peut photographier un invité non prévu, choisir son côté (Nelly/Gégé) et envoyer une demande d'approbation par SMS **et WhatsApp** au parent concerné (lien vers une page publique avec la photo — jamais de MMS) avant de le laisser entrer. L'approbateur peut cliquer le lien ou répondre directement « Oui »/« Non » au message WhatsApp. Une fois approuvée (`/approbations`), l'assignation de table reste manuelle. Suivi automatique : places de réserve restantes à l'approbateur, rapport complet au directeur de festin.
- **Barre de navigation « Liquid Glass »** : capsule flottante inspirée du Dock iOS fourni en référence, réellement translucide dans les deux thèmes (contenu perceptible derrière la plaque), avec flou 34 px/saturation 185 %, bord lumineux, doubles reflets intérieurs, ombre profonde, tuiles arrondies translucides de 44 px et bouton central de 84 px. Les libellés restent visibles pour l'usage opérationnel. En orientation paysage (téléphone tourné, ou iPad), elle bascule en bande verticale fixée au bord droit de l'écran ; le contenu de la page défile normalement de haut en bas, indépendamment de la barre.
- **Bande d'information de base sur `/scan`** : nombre d'invités arrivés/attendus et une jauge compacte du remplissage de la salle, juste au-dessus de la barre de navigation — ouvre le tableau de bord complet au tap.
- **Historique (`/history`) réservé à l'admin** : les autres rôles (directeur, placeur, agent scan) n'y ont plus accès.
- **Déplacer une personne seule vers une autre table** : depuis « Qui est arrivé ? », un bouton ⇄ par personne (réservé aux rôles avec la capacité de déplacer) la détache de son groupe et crée une fiche à une seule personne à la table choisie — pour la regrouper avec une invitation déjà présente à cette table, utiliser ensuite « Fusionner avec un autre groupe » depuis la nouvelle fiche.
- **Bouton central de la barre de navigation adapté au rôle** : Scan pour la plupart des rôles, mais Tableau de bord pour le directeur de festin — son travail commence par surveiller le remplissage. Le directeur possède aussi un onglet Scan dédié à la place de Staff; une fois sur le scanner, le bouton central devient la prise de photo.
- **Ajout d'un invité consolidé dans « Qui est arrivé ? »** : le bouton « + » de cette liste ajoute une personne nommée **déjà marquée arrivée**, en gardant le déclenchement de l'assignation à une table de réserve en cas de dépassement — l'ancien bouton autonome « + Non prévu » et le lien « Gérer les membres du groupe » ont disparu de la fiche de check-in (consolidés ici), réservé aux rôles avec la capacité de soumettre une approbation d'invité. « 📷 Invité surprise » (approbation photo) reste disponible séparément pour les cas où une vérification visuelle stricte est voulue.
- **Renommer directement depuis la fiche** : taper le nom d'une personne dans « Qui est arrivé ? » le modifie sur place (comme le titre de la fiche) — réservé aux rôles avec la capacité de gérer les membres.
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

Voir `CHANGELOG.md` pour le détail de **v1.37.0** et l'historique des versions.
