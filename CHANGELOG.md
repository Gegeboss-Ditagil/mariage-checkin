# Changelog

Toutes les évolutions fonctionnelles significatives de l'application sont consignées ici.
Le projet suit Semantic Versioning (`MAJOR.MINOR.PATCH`). Voir `docs/VERSIONING.md`.

## [1.53.5] — 2026-09-16

Retour de Gersom (capture d'écran de la fiche détaillée d'une demande d'approbation "Test") : « il y a un problème avec les deux flèches, corrige » — la flèche précédente recouvrait partiellement le badge "Côté Gégé/Nelly" juste en dessous de la photo.

### Corrigé
- **`app/approbations/page.tsx` : les flèches précédente/suivante de la fiche détaillée d'une demande étaient positionnées à un pourcentage fixe de la hauteur du viewport** (`fixed left-3/right-3 top-[46%]`), une estimation censée les aligner sur la photo mais qui ne correspondait pas à sa position réelle une fois la hauteur variable de l'en-tête prise en compte — elles atterrissaient alors par-dessus le badge "Côté Gégé/Nelly" juste en dessous, le recouvrant partiellement (texte illisible, comme dans la capture transmise). Corrigé en ancrant les deux boutons directement au conteneur de la photo (nouveau wrapper `relative`), qui a toujours une position et une hauteur connues : les flèches restent désormais systématiquement centrées sur la photo elle-même, jamais sur le contenu en dessous, quelle que soit la taille de l'écran ou la longueur du titre de la demande.

### Tests
- `tests/guest-approvals.test.ts` (1 nouveau test verrouillant l'ancrage au conteneur de la photo ; 1 test existant ajusté pour les tailles de flèche désormais responsives — 44px sur mobile, 56px à partir de `sm:`).

## [1.53.4] — 2026-09-16

Retour de Gersom (capture d'écran `/approbations` + message vocal) : (1) après avoir réellement autorisé les notifications et reçu une vraie alerte push sur son iPhone, le bouton restait bloqué sur « notifications à configurer » ; (2) « je ne peux pas swipe left or right » — le swipe pour supprimer (v1.53.2) ne fonctionnait toujours pas du tout, malgré le correctif précédent.

### Corrigé
- **`components/PushNotificationButton.tsx` ne reflétait jamais l'état réel du navigateur/OS au chargement** : le statut affiché démarrait toujours à `'idle'` et ne changeait qu'en réaction à un clic dans la session en cours ; un échec ponctuel (réseau, timing) lors d'un essai précédent laissait le message bloqué sur « à configurer » même une fois les notifications effectivement actives (abonnement déjà enregistré, vraies alertes reçues). Nouveau `useEffect` de réconciliation au montage : si `Notification.permission === 'granted'` et qu'un abonnement `pushManager` existe déjà, le statut passe directement à `'enabled'` ; si la permission est réellement `'denied'`, le statut le reflète aussi immédiatement — sans attendre un nouveau clic.
- **Swipe pour supprimer sur `/approbations` (`components/SwipeableDeleteCard.tsx`) toujours non fonctionnel après le correctif v1.53.2** (« verrouillage d'axe » : ne capturer le pointeur qu'après avoir détecté un geste horizontal) — confirmé par un second test réel de Gersom : tapoter la carte l'ouvre bien, mais aucun glissement, même partiel, ne produit de réaction. Cause probable : sur iOS Safari, ne PAS capturer le pointeur dès `onPointerDown` laisse le moteur natif trancher seul le sens du geste avant que le JS n'ait pu observer assez de mouvement pour justifier une capture tardive — avec `touch-action: pan-y`, WebKit tranche alors presque systématiquement pour un défilement vertical natif, et plus aucun `pointermove` horizontal exploitable n'est jamais délivré à React. Nouvelle approche, conforme à la spécification touch-action/Pointer Events (utilisée par la plupart des bibliothèques de glissement) : capturer le pointeur **immédiatement** à `onPointerDown`, suivre `pointermove` pour tout déplacement horizontal, et compter sur le navigateur pour annuler proprement la séquence (`pointercancel`, déjà câblé sur `onPointerUp`) dès qu'il détecte lui-même un défilement vertical dominant — `touch-action: pan-y` garantit que ce défilement natif reste possible malgré la capture. Diagnostic par lecture du code et de la spécification (aucun appareil iOS réel disponible dans cet environnement pour reproduire) — à reconfirmer par Gersom.

### Tests
- `tests/push-notification-instructions.test.ts` (1 nouveau test verrouillant le `useEffect` de réconciliation au montage).
- `tests/approbations-ux-improvements.test.ts` (test de capture immédiate du pointeur remplace celui du verrouillage d'axe, devenu obsolète).

## [1.53.3] — 2026-09-16

Retour de Gersom (2 captures d'écran, `/tables/[tableId]` table 1 et `Famille Mbiyavanga Mavinga`/table 4) : (1) le badge "Non arrivé" prend trop de place sur la ligne ; (2) toucher un nom devrait mettre en évidence son siège ; (3) dernier assessment demandé sur toutes les lectures OCR du plan photographié ("Fiston" lu "Fixton/Fixon").

### Ajouté
- **`StatusBadge` gagne une variante `compact`** (point coloré de 10px, sans texte — libellé toujours disponible via `title`/`aria-label`) utilisée sur `/tables/[tableId]` et `/table/[tableId]` uniquement, où la ligne cumule déjà nom + compteur "X/Y" + jusqu'à quatre icônes rondes. `/search`, `/staff` et `/dashboard/liste` gardent le badge texte complet (chacun a sa propre ligne pour le nom, aucun problème d'espace signalé sur ces écrans).

### Modifié
- **Toucher une ligne d'invitation sur `/tables/[tableId]`/`/table/[tableId]` met désormais en évidence son siège** sur le panneau "Vu sur le plan photographié" (au lieu de naviguer vers `/checkin/[invitationId]`, devenu redondant depuis l'ajout du bouton ✅ dédié en v1.51.0) — quand une correspondance de siège existe ; sans correspondance, la ligne continue de naviguer comme avant. Le bouton 🪑 réutilise désormais la même fonction (`highlightSeats`), sans duplication.

### Corrigé
- **Dernier assessment des 393 sièges nommés de `lib/floorPlanSeats.ts`** (`TABLE_SEAT_NAMES`), recoupés table par table (jamais entre deux tables différentes) avec les 250 invitations actuellement en base : **75 corrections de lecture OCR appliquées**, chacune la seule candidate plausible sur sa table avec une marge de confiance nette (ex. « Fixon Zola » → « Fiston Zola », table 4 ; « Jean-Ciben Ca ous » → « Jean-Clivens Le Caous », table 1, déjà identifiée en v1.48.0 mais jamais reportée dans le fichier ; « Edo Tukwa » → « Edo Tukula », table 3 ; liste complète dans le commentaire en tête de `lib/floorPlanSeats.ts`). **13 cas restent ambigus** (plusieurs candidats trop proches sur la même table — signalés ci-dessous, décision de Gersom nécessaire) et **5 sans aucun candidat** — volontairement PAS devinés.

### Signalé à Gersom (décision nécessaire, rien appliqué automatiquement)
- **Table 4** : « Henri O. Momba »/« Henricia O. Momba » face à « Henri Onatshungu Momba »/« Henriela Onatshungu Momba » en base (lequel est lequel ?) ; « Stacky M. Mavinga » et « Jessy B. M. Mavinga » ont chacun deux candidats Mbiyavanga Mavinga très proches.
- **Table 2** : « Deusdedit Dos Goncalves » — trois candidats Dos Goncalves également proches.
- **Table 8** : « Luzolo P. Menga » — aucun candidat proche sur cette table (la personne correspondante, « Luzolo Patrick Menga », est en base à la table 41 depuis la réorganisation v1.50.0).
- **Table 11** : « Teresa Ndani » et « Ketsia Neves » — candidats trop proches d'autres membres de la même table.
- **Tables 14, 21, 28, 40** : autres cas à deux candidats proches (détail dans `tests/floor-plan-seats.test.ts`/le commentaire du fichier).
- **Tables 40/41 (Bembo/Mateus, Diego Ramos/Jade Magnus)** : divergences déjà connues et documentées (v1.50.0) entre la photo et une réorganisation ultérieure — pas des erreurs de lecture, volontairement laissées telles quelles (la photo reste un instantané fidèle au moment où elle a été prise, jamais mise à jour a posteriori pour suivre un déplacement réel).

### Tests
- `tests/floor-plan-seats.test.ts` (2 nouveaux tests, spot-check des corrections).
- `tests/table-seat-wheel.test.ts` (2 nouveaux tests : badge compact, tap-pour-surligner).

### Documentation mise à jour
`CHANGELOG.md`, `CLAUDE.md`

### Version
`Version: 1.53.2 → 1.53.3`

### Tests exécutés
- `npx tsc --noEmit` — OK
- `node --test tests/*.test.ts` — 302/302 OK
- `npm run build` — OK
- `git diff --check` — OK

### Migrations
Aucune (changements purement client/informatifs, `invitations.table_id` reste l'unique source de placement).

## [1.53.2] — 2026-09-16

Retour de Gersom (2 captures d'écran) : (1) message d'erreur Twilio affiché à tort alors que la fonctionnalité est volontairement désactivée ; (2) le swipe pour supprimer une demande décidée sur `/approbations` ne fonctionne toujours pas (rôle admin confirmé directement en base avant d'aller plus loin, voir `docs/QE_QA_PROCESS.md`).

### Ajouté
- **Bouton bascule « SMS/WhatsApp (Twilio) » sur `/admin`** : active/désactive `events.twilio_enabled` (migration `0055_events_twilio_enabled.sql`, appliquée et vérifiée en production Supabase le jour même) sans redéploiement ni accès Vercel — remplace l'ancien interrupteur par variable d'environnement `TWILIO_ENABLED` (v1.48.3). `lib/twilio.ts` (`getTwilioConfig`/`getWhatsAppConfig`/`sendSms`/`sendWhatsApp`) et `lib/guestApprovalNotify.ts` (`notifyApprover`/`notifyApproverDecision`/`notifyFestinDirectors`) reçoivent désormais cet état explicitement en paramètre plutôt que de le lire eux-mêmes ; les trois appelants (`app/api/guest-approvals/route.ts`, `lib/guestApprovalDecide.ts`, `app/api/guest-approvals/[id]/assign-table/route.ts`) le lisent depuis la ligne `events` de l'événement concerné. Les identifiants `TWILIO_*` restent nécessaires sur Vercel pour un envoi réel.

### Corrigé
- **Le message d'erreur Twilio n'apparaît plus tant que la fonctionnalité est volontairement désactivée** : `POST /api/guest-approvals` distingue désormais `sms_skipped` (Twilio désactivé par le toggle admin — jamais un problème) de `sms_error` (Twilio activé mais mal configuré, ou refus d'envoi — un vrai problème à signaler). `components/GuestApprovalCaptureFlow.tsx` n'affiche plus le bandeau rouge « Le message Twilio n'est pas parti » quand `sms_skipped` est vrai.
- **Bug réel — swipe pour supprimer inopérant sur `/approbations`** (`components/SwipeableDeleteCard.tsx`) : le pointeur était capturé (`setPointerCapture`) dès `onPointerDown`, avant de savoir si le geste allait être horizontal ou vertical. Sur WebKit/iOS, capturer un pointeur tactile aussi tôt, combiné à `touch-action: pan-y`, peut faire annuler la séquence de pointeur dès la moindre composante verticale détectée — l'utilisateur ne voyait alors jamais rien se passer, quel que soit son geste. Corrigé en ne verrouillant l'axe (et en ne capturant le pointeur) qu'une fois le mouvement assez net pour trancher (`AXIS_LOCK_THRESHOLD`) : un axe horizontal verrouille le geste (poubelle, suppression possible) ; un axe vertical relâche entièrement la main au défilement natif de la liste, sans jamais entrer en conflit avec lui. N'ayant pas pu reproduire sur un vrai appareil iOS depuis cet environnement, ce correctif part d'une cause plausible identifiée par lecture du code (technique de « direction lock » standard pour ce genre de geste) plutôt que d'une reproduction directe — à reconfirmer par Gersom après ce lot.

### Documentation mise à jour
`CHANGELOG.md`, `CLAUDE.md`, `docs/BUSINESS_RULES.md`, `DEPLOIEMENT.md`

### Version
`Version: 1.53.1 → 1.53.2`

### Tests exécutés
- `npx tsc --noEmit` — OK
- `node --test tests/*.test.ts` — 297/297 OK
- `npm run build` — OK
- `git diff --check` — OK

### Migrations
- `0055_events_twilio_enabled.sql` — appliquée et vérifiée en production Supabase.

## [1.53.1] — 2026-09-16

Bug réel signalé par Gersom (capture d'écran `/scan`, thème Maison) : le titre de la page ("Scanner un QR code" / "Présentez le QR de l'invité devant la caméra") apparaissait superposé et illisible avec la bannière transitoire "Nouvelle approbation" (`components/AccountMenu.tsx`), les deux textes se lisant l'un à travers l'autre.

### Corrigé
- **Root cause** : la bannière utilisait `bg-surface` nu + `shadow-elev-2`, sans le `backdrop-filter` (flou + saturation) que toutes les autres surfaces "verre liquide" de l'app (`.card`, `.action-row`, `.btn-secondary`, `.glass-icon-button`…) appliquent systématiquement avec cette même couleur. `--surface` vaut une quasi-transparence en thème Maison (`rgba(242, 239, 233, 0.045)`, alpha 4.5%) — pensée pour être vue à travers un flou, jamais seule à plat. Sans ce flou, la bannière (positionnée en `fixed` par-dessus le contenu) laissait transparaître intégralement le contenu de la page en dessous, d'où la superposition visible sur `/scan` (le seul écran dont le titre commence immédiatement sous la bannière, sans barre de navigation opaque entre les deux).
- Nouvelle classe `.glass-toast` dans `app/globals.css` (même recette `box-shadow: var(--elev-2)` + `backdrop-filter: blur(20px) saturate(160%)` que `.card`), appliquée à la bannière dans `components/AccountMenu.tsx` à la place de `bg-surface`/`shadow-elev-2` bruts. Comportement et positionnement (paysage compris) inchangés — seul le rendu visuel de la bannière elle-même devient un vrai panneau de verre opaque au flou, comme partout ailleurs dans l'app.

### Documentation mise à jour
`CHANGELOG.md`, `CLAUDE.md`

### Version
`Version: 1.53.0 → 1.53.1`

### Tests exécutés
- `npx tsc --noEmit` — OK
- `node --test tests/*.test.ts` — 293/293 OK
- `npm run build` — OK
- `git diff --check` — OK

### Migrations
Aucune.

## [1.53.0] — 2026-09-15

Retour de Gersom : revirement en cours de message sur une demande d'alignement des colonnes de `/admin/import` avec le format CSV With Joy — décision finale de retirer trois écrans admin plutôt que d'en ajouter un quatrième, pour simplifier l'app à un seul chemin d'import.

### Supprimé
- **`/admin/import`** (import CSV/XLSX générique par association manuelle de colonnes) et sa route `app/api/admin/import/route.ts`. `/admin/import-withjoy` (RPC `admin_replace_invitations`) reste l'unique chemin d'import d'invitations, inchangé.
- **`/admin/diffusion`** ("Diffuser les invitations", lecture Excel/CSV entièrement locale au navigateur, jamais d'écriture serveur) et `lib/invitationDiffusion.ts`. `tests/invitation-diffusion.test.ts` et le script `npm run test:diffusion` retirés avec.
- **`/admin/qr`** ("Associer les QR codes") et sa route `app/api/admin/qr/route.ts` — écran de gestion uniquement : la table `qr_codes` et sa lecture par le scan réel (`app/scan/page.tsx`, `app/placement/page.tsx`) restent intactes et fonctionnelles ; toute nouvelle association `code`/table se fera directement en base.

### Modifié
- `app/admin/page.tsx` : les trois liens correspondants retirés du menu ; "Gérer les tables" et "Importer depuis With Joy" inchangés.
- `app/admin/wizard/page.tsx` : les étapes « Importer les invités » et « Associer chaque invitation à une table » pointent désormais vers `/admin/import-withjoy` ; l'étape « Associer un QR code à chaque table » est retirée (l'assistant passe de 10 à 9 étapes). `app/api/admin/wizard-status/route.ts` ne calcule plus `qrTotal`/`qrManquants`.
- `tests/permissions.test.ts` : l'assertion d'accès admin-seul portant sur `/admin/diffusion` est remplacée par une assertion équivalente sur `/admin/import-withjoy`.

### Documentation mise à jour
`README.md`, `CHANGELOG.md`, `CLAUDE.md`, `docs/BUSINESS_RULES.md`, `docs/DATA_AND_FORMS.md`, `docs/DATA_CHANGE_INSTRUCTIONS.md`, `docs/QA_SCENARIOS.md`, `docs/VERSIONING.md`, `DEPLOIEMENT.md`, `ASSIGNATION_TABLES.md`.

Aucune migration : uniquement des écrans/routes retirés et des liens internes recâblés, aucune donnée touchée.

## [1.52.0] — 2026-09-15

Retour de Gersom : tentative d'import complet depuis `/admin/import-withjoy` avec `guest-list_56.csv` ("le CSV final... écrase ce qui est dans l'app"), bloquée par une erreur "Échec atomique de l'import". Root-cause diagnostiquée par reproduction directe (contrainte FK), corrigée, puis le remplacement complet demandé a été exécuté en production après vérification.

### Corrigé
- **Bug réel — le remplacement complet des invitations échouait systématiquement dès qu'une demande d'invité surprise avait un lien "arrivé avec"** (`guest_approval_requests.linked_invitation_id`, migration `0046` du 02/09/2026) : cette contrainte de clé étrangère n'avait jamais reçu de clause `ON DELETE` (contrairement à `audit_logs`/`exceptions`, qui font bien `SET NULL`) — un oubli de l'époque, jamais déclenché avant faute d'un vrai remplacement complet tenté depuis. Migration `0054_guest_approval_linked_invitation_on_delete_set_null.sql` : `ON DELETE SET NULL`, même comportement que les autres références à `invitations` — la demande d'approbation (historique) survit toujours, seul son lien est effacé si l'invitation liée disparaît.
- **Bug réel — numéro de téléphone corrompu par une apostrophe de tableur** : `guest-list_56.csv` (comme plusieurs exports précédents) préfixe parfois la colonne "phone number" d'une apostrophe (ex. `'+41799150386`, convention de tableur pour forcer le format texte), jamais un caractère du vrai numéro. `lib/withjoyImport.ts` (`cleanPhone`) et `scripts/build_plan_from_csv.py` (gardés synchronisés) la retirent désormais. `tests/withjoy-import.test.ts` (2 nouveaux tests).

### Données
- **Remplacement complet des invitations** (263 → 259), exécuté via `admin_replace_invitations` avec le CSV final transmis par Gersom — décision explicite d'écraser plutôt que de continuer la synchronisation ciblée des versions précédentes (v1.47.0-v1.51.0), puisque plusieurs éléments en base ne correspondaient plus au CSV à jour. Sauvegarde automatique (`import_backups`, comme à chaque remplacement complet) avant écriture.
- **0 table en surcapacité après ce remplacement** (vérifié directement) — confirme que "les tables en surcapacité" signalées par Gersom sont bien résolues par ce CSV à jour, contrairement aux tentatives précédentes de recoupement manuel qui restaient bloquées sur des occupants déjà en base.
- `nombre_arrive = 0` confirmé partout avant l'exécution (aucune arrivée réelle à perdre, `event.status = 'test'`).

### Documentation mise à jour
`CHANGELOG.md`, `CLAUDE.md`, `docs/DATA_CHANGE_INSTRUCTIONS.md`

### Tests exécutés
`npx tsc --noEmit`, `node --test tests/*.test.ts`, `npm run build`, `git diff --check`

### Migrations
`0054_guest_approval_linked_invitation_on_delete_set_null.sql` — appliquée et vérifiée en production Supabase le jour même.

## [1.51.0] — 2026-09-14

Retour de Gersom (2 photos : un agent scan renommant un invité, la fiche de la table 1). Migration `0053_rename_member_syncs_solo_display_name.sql` appliquée et vérifiée en production Supabase le jour même.

### Corrigé
- **Renommage réservé à `admin`/`directeur`/`placeur`** : `agent_checkin` (« un agent qui scanne ») pouvait jusqu'ici renommer une invitation entière (titre du haut) ou un membre individuel depuis « Qui est arrivé ? » — capacité `manageMembers` retirée de ce rôle dans `lib/permissions.ts` (les deux routes API, `/api/invitations/rename` et `/api/members/rename`, la refusaient déjà côté serveur ; `/api/invitations/rename` et `/api/members/rename` ajoutées au filet `canAccessPath` pour ce rôle par cohérence).
- **Le nom du haut suit la correction, pour une invitation solo uniquement** : renommer l'unique membre d'une invitation solo (ex. « Ydgdgd » → un vrai nom) via « Qui est arrivé ? » met désormais aussi à jour `invitations.nom_affichage` (titre affiché en haut de la fiche) — jusqu'ici seule la ligne `guests` était corrigée, le titre restait sur l'ancien nom. Pour un groupe (plusieurs membres), le libellé du groupe (ex. « Famille Neves ») ne change jamais, quel que soit le membre renommé. La propagation en temps réel entre agents ayant la même fiche ouverte fonctionnait déjà (table `guests` dans la publication realtime depuis l'origine) — vérifiée, pas de correctif nécessaire là.

### Interface
- **Trois icônes par invitation sur `/tables/[tableId]` et `/table/[tableId]`** (retour de Gersom : « je ne suis pas capable d'aller dans la prochaine page pour les invitations facilement... comment je quitte ce mode ? ») — le bouton unique 📍 (v1.48.8/v1.48.9, qui mettait un siège en évidence) devient trois boutons distincts : 📍 localise désormais la table dans la salle (navigue vers `/plan-table?table=N`, qui se déplie directement sur le plan visuel avec cette table mise en évidence — nouvelle lecture du paramètre d'URL sur `/plan-table`, réutilise le mécanisme `locateOnPlan` déjà existant) ; 🪑 reprend exactement l'ancien comportement de 📍 (met le siège en évidence sur le dessin « vu sur le plan photographié » plus bas) ; ✅ ouvre explicitement `/checkin/[invitationId]`, en plus du tap sur le nom (inchangé, jamais remplacé). `app/plan-table/page.tsx` gagne un boundary `Suspense` (requis par `useSearchParams`, même convention que `/tables/[tableId]`).

### Version
`Version: 1.50.0 → 1.51.0`

### Documentation mise à jour
`CHANGELOG.md`, `CLAUDE.md`, `docs/BUSINESS_RULES.md`, `docs/QA_SCENARIOS.md`, `DEPLOIEMENT.md`, `ASSIGNATION_TABLES.md`, `docs/DATA_AND_FORMS.md`, `docs/DATA_CHANGE_INSTRUCTIONS.md`, `docs/VERSIONING.md`

### Tests exécutés
`npx tsc --noEmit`, `node --test tests/*.test.ts` (296/296), `npm run build`, `git diff --check`

### Migrations
`0053_rename_member_syncs_solo_display_name.sql`

## [1.50.0] — 2026-09-14

Suite directe de v1.49.0, sur demande explicite de Gersom : « tables en surcapacité corrected, jade magnus n'est plus invité, voici le dernier a jours de with joy » (`guest-list_53.csv` → `guest-list_54.csv` → `guest-list_55.csv`, ce dernier ajoutant Tio Godart et son épouse table 40, confirmé par une capture d'écran du plan seatplan.io de cette table). **Aucune migration** (aucun changement de schéma), écritures directes en production Supabase, vérifiées le jour même. `nombre_arrive = 0` confirmé sur les 29 invitations touchées avant toute écriture, `event.status = 'test'` inchangé.

### Données
- **Jade Magnus n'est plus invitée** (confirmé par Gersom) — sa fiche placeholder v1.47.0 (jamais matérialisée, sans table) est supprimée.
- **7 données de test supprimées** : des fiches "Invité surprise approuvé" créées pendant les tests du parcours d'approbation (noms factices : "Gtfxfyh test", "Hsbsbshshs", "Gersom Test", "Lui Dos", "Tetsfffd", "X", "Testt"), occupant à tort des places aux tables 1, 41 et 42 et faussant les calculs de capacité depuis plusieurs versions — la table 41 (Houston) se retrouve entièrement vidée de ces artefacts.
- **5 doublons supplémentaires découverts** (recoupement téléphone/party-id/absence des exports With Joy récents), sur le même modèle qu'en v1.49.0 :
  - "Famille Neves" (table 11) regroupait à tort deux invitées distinctes reconnues séparément par `guest-list_55.csv` (tags F011/F001) — scindée en "Andrea Neves" (reste table 11) et "Ketsia Neves" (désormais table 1, sa propre fiche placeholder v1.47.0 déjà correcte par téléphone).
  - "Famille Manuel" (sans table) était déjà "Famille non-nommé"/Sergio Manuel (table 29, même téléphone).
  - "Famille Mvovi" (sans table, 2 personnes) était Costa Mvovi (déjà table 3) + son épouse, confirmé par le même party-id With Joy — fusionnée sur la fiche de Costa Mvovi.
  - "Tia Nzuzi Culumbu" (standalone, table 29) était le même nom que le membre "Tia Nzuzi Culumbu" de la fiche placeholder "Famille Nzuzi Culumbu" (v1.47.0) — fusionnée, désormais table 8.
  - "Daniel Victor" (table 3) a disparu de tous les exports With Joy depuis `guest-list_50` ; son téléphone est celui d'"Oredezo Blancky" (placeholder v1.47.0, même table 3) — même personne, nom corrigé.
- **Table 40 : scission confirmée par une photo du plan seatplan.io** (transmise avec l'ajout de Tio Godart) recoupée avec les tags CSV : "Famille Matondo" scindée (Eude+Francisco restent table 40 ; Huguette+Julianna table 36, tag T036) et "Famille Lembe" scindée (Youyou Lembe seule désormais table 31, tag T031 ; Odon Tchiteya sans tag CSV ni présence sur la photo — fiche séparée, sans table, signalé à Gersom).
- **Nouvelle invitation "Famille Godart"** (Tio Godart Culumbu + épouse, table 40) ajoutée par Gersom via `guest-list_55.csv`, confirmée par la photo du plan.
- **Table 41 (Houston) débloquée** : une fois vidée des données de test, ses 10 places accueillent exactement Famille Bembo (3) + Famille Menga (4) + Luzolo Patrick Menga (1) = 8/10, résolvant le blocage de capacité signalé en v1.49.0 pour ces trois fiches.
- **Maria Irène Gomes** placée table 18 (tag confirmé) : la table n'était en réalité pas pleine, "Famille Momene" (2 places) étant déjà marquée `ne_viendra_pas = true` depuis v1.47.0.
- **1 rafraîchissement de contact** : téléphone de Zoya Inacio.
- **1 nouvelle invitation sans table** : "Nelly Dos Goncalves" (`guest-list_55.csv`, aucun tag, aucune correspondance de téléphone avec Erika ou la Famille Mbala Dos Goncalves).

### Signalé à Gersom, non résolu dans ce lot
- **"Famille Michaud" reste sans table** : le tag CSV (T041) remplirait exactement les 2 dernières places de la table 41 aux côtés de Bembo/Menga/Luzolo, mais la photo du plan seatplan.io de la table 40 (même jour) montre "Michaud Culumbu"/"Femme Michaud" assis à la table 40 — conflit réel entre les deux sources, décision explicite nécessaire.
- **Table 29 toujours bloquée** : il ne reste qu'une place libre après le nettoyage des doublons (Famille Vincent Nkouka, Rafael Opetum Isei, Rene Herrera, Weplo Culumbu, Ya Dany Culumbu déjà assis, aucun tag CSV trouvé pour "Famille Vincent Nkouka") alors que Famille Nzasi (3) et Laura Humba (1) veulent y entrer.
- **Table 34 toujours pleine** (10/10, tous déjà tagués T034) : aucun doublon trouvé pour libérer une place pour Jean-Claude Nsenda.
- **"Odon Tchiteya"** (scindé de "Famille Lembe") reste sans table et sans tag CSV — toujours invité ? nouvelle table ?
- Les 21 invitations déjà placées dont le tag CSV diffère de la table actuelle (dont "Famille Matuba" 37→18, connue depuis v1.47.0) et les échanges physiques 18/34 restent hors périmètre, inchangés.

## [1.49.0] — 2026-09-14

Mise à jour ciblée de la liste d'invités depuis `guest-list_52.csv` (nouvel export With Joy, confirmé par Gersom synchronisé avec le plan seatplan.io — 3 photos + PDF `seating-chart-Mariage-Nelly---Gege-2026-09-14.pdf`, 42 tables). Comparaison nom-par-nom + numéro de téléphone (jamais un réimport complet, conformément à `docs/DATA_CHANGE_INSTRUCTIONS.md` section 6) entre les 274 invitations existantes et les 406 lignes du CSV. **Aucune migration** (aucun changement de schéma), écritures directes en production Supabase, vérifiées le jour même. Aucune arrivée enregistrée dans l'événement (`nombre_arrive = 0` partout, `event.status = 'test'`) au moment de ces écritures — aucun risque de déplacer quelqu'un déjà arrivé.

### Données
- **26 rafraîchissements de contact** (téléphone/email) sur des invitations déjà présentes, reconnues par correspondance exacte de nom.
- **5 doublons découverts en recoupant par NUMÉRO DE TÉLÉPHONE** (pas seulement par nom) les 6 fiches "ajoutées sans table" en v1.47.0 avec le reste de la base — chacune avait en réalité déjà un homologue correct, placé ailleurs sous un nom légèrement différent :
  - "Famille Nzuzi" (table 6, noms fabriqués "Seba Nzuzi, Lucia Nzuzi") et "Famille Domingos" (table 32, noms fabriqués "Lucie Domingos, Epoux Domingo") partageaient le même téléphone — même couple. Doublon supprimé, vrais noms "Lucie Nzuzi, Seba Domingos" appliqués sur la fiche conservée (déjà à la bonne table).
  - "Nzuzi Laisana" (sans table) était une faute de frappe With Joy pour "Denzu Laisana", déjà présente (table 16).
  - "Famille Ndani Ndoba" (sans table) était déjà présente sous "Famille Ndani" (table 9) avec un nom de famille tronqué ("Maurice Ndani" au lieu de "Maurice Ndani Ndoba") — corrigé sur la fiche conservée.
  - "Famille Dos Goncalves" (sans table) était déjà présente sous "Famille Mbala Dos Goncalves" (table 2, même téléphone ET même email).
  - "Famille Bembo" (sans table) était déjà présente sous "Famille suisee cousine" (table 36) avec un nom manifestement erroné ("Jenniffer suisee cousine" — une description prise pour un nom) ; doublon supprimé, vrais noms appliqués sur "Famille Bembo".
- **3 fiches "ajoutées sans table" confirmées sans doublon** (aucune collision de téléphone ailleurs dans la base), complétées avec les vrais noms de membres : Famille Lusuena (Joana + Fifi Lusuena, désormais table 12), Famille Nzasi (Babel, Prince, Enfant Nzasi, table 29 confirmée par tag mais non assignée — voir non fait), Famille Menga (Jacquie, Lambert, Bana Menga ×2, table 41 confirmée par tag mais non assignée — voir non fait).
- **2 nouvelles invitations** sans correspondance existante : Maria Irène Gomes (table 18 confirmée par tag, non assignée), Jean-Claude Nsenda (table 34 confirmée par tag, non assignée).

### Non fait dans ce lot (signalé à Gersom, capacité ou ambiguïté à trancher avant d'écrire)
- **5 tables en surcapacité** si les tags CSV52 sont appliqués tels quels par-dessus les occupants actuels de la base (1, 9, 18, 29, 34, plus 41 qui accumule Bembo/Menga/Michaud) — nécessite de déplacer certaines personnes déjà placées ailleurs, hors périmètre de ce lot ciblé.
- **2 fiches dont les membres ont des tags de table CSV contradictoires entre eux** : "Famille Matondo" (Julianna/Francisco → T40, Huguette/Eude → T36) et "Famille Neves" (Andrea → T1, Ketsia → T11, cette dernière existant aussi en doublon comme invitation autonome non placée depuis v1.47.0).
- **21 invitations déjà placées dont le tag CSV52 diffère de la table actuelle en base** (au-delà des 5 doublons corrigés ci-dessus) — nécessite une réorganisation réelle de places déjà occupées (ex. "Famille Matuba" table 37→18, discrépance déjà documentée en v1.47.0/v1.48.0 ; "Tia Nzuzi Culumbu" table 29→8 ; "Famille Lukau"/"Famille Neves"/"Teresa Ndani" table 11→1 ; "Pajos Mpapa"/"Nsimba Mambakasa"/"Famille Esamba" table 2→6 ; etc.) — non appliqué, présenté à Gersom pour confirmation.
- **"Jade Magnus"** (fiche ajoutée sans table en v1.47.0) a disparu de guest-list_52.csv sans marque de refus explicite — ni renommage identifié ni suppression appliquée, signalé pour confirmation.
- **Échange physique des tables 18 et 34** sur le plan de salle (confirmé par Gersom) — affecte uniquement `components/FloorPlan.tsx` (positions visuelles), aucune donnée d'invitation concernée ; pas encore appliqué.
- **Rafraîchissement complet de `lib/floorPlanSeats.ts`** (`TABLE_SEAT_NAMES`) depuis le nouveau plan seatplan.io (42 tables, désormais confirmé synchronisé avec With Joy) — toujours purement informatif, pas encore retranscrit.



Complète le dessin "vu sur le plan photographié" avec le sens inverse (siège → invitation/membre), sur les trois écrans qui l'affichent — aucune migration.

### Ajouté
- **`/plan-table`, `/tables/[tableId]`, `/table/[tableId]`** : toucher un siège sur le dessin retrouve désormais aussi, parmi les invitations déjà listées pour cette table, celle dont un membre correspond exactement (jamais approché) au nom lu sur ce siège — surlignage de sa ligne dans la liste + défilement vers elle. Complète le sens déjà existant (toucher un nom → surligner son siège).
- **`GuestArrivalPanel` (`/checkin/[invitationId]`)** : même sens inverse — toucher un siège retrouve, parmi les membres de "Qui est arrivé ?", celui dont le nom correspond exactement, et surligne sa ligne.
- **`lib/floorPlanSeats.ts`** : nouvel export `namesMatch(a, b)`, factorisant la comparaison exacte (accents/casse ignorés) déjà utilisée par `findSeatIndexByName`, pour ce nouveau sens de recherche.

### Non fait dans ce lot (signalé à Gersom, pas silencieusement ignoré)
- "Quand j'ajoute quelqu'un dans l'application, que ça l'ajoute aussi sur la table [dessin]" — incompatible avec la nature du dessin actuel, qui est une lecture OCR **statique** de deux photos figées (`TABLE_SEAT_NAMES`), jamais une structure vivante liée aux vrais sièges. Nécessiterait la table `sièges` à ID stable déjà mise en attente en v1.48.6 (import With Joy définitif).
- Mise à jour complète (invitations + tables + sièges) depuis un futur CSV With Joy "final" : toujours bloquée sur l'absence d'identifiant stable par personne dans les exports reçus à ce jour (voir v1.48.6) et sur la décision en attente concernant le nœud Nzuzi/Domingos/Culumbu (tables 6/29/32) découvert en comparant `guest-list_51.csv` à la base actuelle.

### Tests
- `tests/table-seat-wheel.test.ts` (3 nouveaux/étendus), `tests/floor-plan-seats.test.ts` (1 mis à jour) : verrouillent le nouveau sens de recherche sur les trois écrans.

## [1.48.8] — 2026-09-14

Deux ajouts au dessin "vu sur le plan photographié" (4 photos, retour de Gersom), toujours purement informatif — aucune migration.

### Ajouté
- **`/plan-table`** : toucher une invitation dans la liste au-dessus du dessin surligne désormais aussi sa ligne dans cette liste (fond teinté + liseré accent), en plus du/des siège(s) déjà mis en évidence sur le dessin — "quand j'appuie sur Jonas, j'aimerais aussi que son nom en haut dans la fiche soit surligné". Nouvel état `selectedInvitationId`, réinitialisé partout où `highlightedSeats` l'est déjà (changement de table/zone, tap direct sur un siège de la roue).
- **`/tables/[tableId]` et `/table/[tableId]`** (fiche d'une table, jusqu'ici sans aucun dessin) gagnent le même panneau "Vu sur le plan photographié" que `/plan-table` et `/checkin/[invitationId]`, affiché sous la liste des invitations — "en dessous des noms, on puisse aussi afficher la table... garder la même logique... savoir où est-ce que la personne est assise". Un bouton 📍 par invitation (uniquement quand une correspondance de nom existe, jamais approchée) surligne son ou ses siège(s) et fait défiler jusqu'au dessin ; n'entre pas en conflit avec le tap sur le nom, qui continue d'ouvrir le check-in comme avant. Même mécanisme que sur les deux autres écrans (`lib/floorPlanSeats.ts`, `components/TableSeatWheel.tsx`), aucune nouvelle logique : toujours purement informatif, jamais une source de placement (`invitations.table_id` inchangé).

### Tests
- `tests/table-seat-wheel.test.ts` : 3 nouveaux tests (surlignage de ligne sur `/plan-table`, panneau + bouton 📍 sur les deux routes de fiche de table).

## [1.48.7] — 2026-09-14

Nettoyage interne de `components/BottomNav.tsx`, sans aucun changement de comportement — première passe de simplification demandée par Gersom ("une passe de nettoyage plutôt que d'empiler encore des patches") maintenant que la navigation par rôle (admin/directeur/placeur/agent_checkin/visibilite) est stabilisée depuis le 14/09/2026 (v1.46.0/v1.46.1).

### Modifié
- `ITEMS.admin`, `ITEMS.directeur` et `ITEMS.placeur` étaient trois littéraux (quasi-)identiques (seul l'ordre interne d'`admin` différait, sans effet réel : la répartition gauche/centre/droite se base toujours sur `SIDE_ORDER`/`CENTRAL_HREF`, jamais sur cet ordre). Remplacés par une constante partagée unique `DIRECTOR_STYLE_ITEMS`, réutilisant les items déjà nommés (`SEARCH_ITEM`, `PLAN_ITEM`, `DASHBOARD_ITEM`, `SCAN_ITEM`, `APPROVALS_ITEM`) au lieu de ré-écrire des objets `{ href, label, icon }` en dur.
- Les trois branches contextuelles `/dashboard`, `/agenda`, `/scan` (`isDirectorStyleNav`) n'ont volontairement pas été fusionnées malgré leur ressemblance : `/agenda` et `/scan` sont identiques mais `/dashboard` diffère (badge d'approbations vs Bord), et une dizaine de tests existants (`tests/navigation-resilience.test.ts`, `tests/approbations-ux-improvements.test.ts`) épinglent précisément la structure source de ces trois branches séparées — fusionner aurait exigé une réécriture de tests disproportionnée au gain (quelques lignes).

### Tests
- `tests/approbations-ux-improvements.test.ts`, `tests/navigation-resilience.test.ts`, `tests/placeur-director-nav.test.ts` : les assertions qui lisaient les anciens littéraux `admin: [...]`/`directeur: [...]`/`placeur: [...]` vérifient désormais `DIRECTOR_STYLE_ITEMS` et son partage littéral entre les trois rôles (`placeur: DIRECTOR_STYLE_ITEMS` etc.) — même garantie qu'avant (Scan présent, jamais Staff, Approbations en dernier), en plus stricte (le partage du même tableau garantit l'identité, pas seulement une comparaison de contenu).

## [1.48.6] — 2026-09-14

Préparation pour un futur import final With Joy : identifiant stable par invitation (`withjoy_party_id`), sans encore construire l'import lui-même.

### Ajouté
- **`invitations.withjoy_party_id`** (migration `0052_invitations_withjoy_party_id.sql`) : colonne texte nullable stockant la valeur brute de la colonne `party` de l'export With Joy (ex. `table-002-party-006`) — vérifiée stable pour la même personne/le même groupe entre deux exports différents (`guest-list_48.csv` vs `guest-list_50.csv`), contrairement au nom. Sert uniquement à retrouver une invitation existante lors d'un futur import.
- `lib/withjoyImport.ts` : `ImportGroup` gagne `withjoyPartyId` (valeur brute de `party`, `null` pour un groupe `SOLO-N` synthétique). `admin_replace_invitations` (redéfinie dans la même migration) et `app/api/admin/import-withjoy/route.ts` écrivent ce champ lors d'un import complet.

### Analysé (sans changement de comportement)
- **Le numéro parfois présent dans `party` (`table-XXX`) ne correspond PAS à notre vraie table** — vérifié sur `guest-list_50.csv` : seulement ~1/3 des groupes concordent avec le vrai tag `F0xx`/`T0xx`. C'est un identifiant interne à une fonctionnalité de placement propre à With Joy, distincte des tags que notre import utilise déjà. Le placement continue exclusivement de venir du tag `F0xx`/`T0xx` de la colonne `tags`, inchangé — `withjoy_party_id` n'est et ne sera jamais une source de placement.

### Non fait dans ce lot
- Table de sièges avec ID stable par chaise, et l'import final lui-même — remis à plus tard, une fois le fichier With Joy définitif transmis (demande explicite de Gersom).

### Tests
- `tests/withjoy-import.test.ts` (4 nouveaux tests) : capture de `withjoyPartyId` depuis le CSV, comportement sur un party vide, stabilité à travers plusieurs invitations issues d'un même party, câblage route+migration.

### Migrations
- `0052_invitations_withjoy_party_id.sql` — exécutée et vérifiée en production Supabase le 14/09/2026 (colonne additive nullable + redéfinition de `admin_replace_invitations`, aucune donnée existante modifiée).

Version: 1.48.5 → 1.48.6

## [1.48.5] — 2026-09-14

Le dessin "vu sur le plan photographié" apparaît aussi sur la fiche d'un invité, et se surligne au toucher depuis les deux pages qui le montrent + le bouton "Invité surprise" devient une icône à côté du "+", avec un bouton "Terminé".

### Ajouté
- **`GuestArrivalPanel` (fiche `/checkin/[invitationId]`) affiche désormais le dessin "vu sur le plan photographié"** de la table réelle de l'invitation (nouvelle prop `tableNumber`, issue de `invitations.table_id` → `tables.number`, jamais devinée par nom) — ne s'affiche que si cette table a une lecture photo. Un bouton 📍 apparaît à côté de chaque membre dont le nom correspond exactement (accents/casse ignorés) à un siège de sa table ; le toucher surligne ce siège et fait défiler jusqu'au dessin.
- **`lib/floorPlanSeats.ts` : `findSeatIndexByName(tableNumber, name)`** — correspondance exacte uniquement, jamais une tolérance approchée (deux personnes différentes peuvent avoir des noms très proches sur des tables différentes).
- **Sur `/plan-table`, toucher une invitation dans la liste au-dessus du dessin surligne tous ses membres retrouvés d'un coup**, au lieu de naviguer vers `/tables/[tableId]` — toucher la table elle-même (en-tête/carte) continue de naviguer, inchangé. Nouveau callback `onSelectInvitation` sur `TableCard`, actif uniquement sur la carte de la table sélectionnée.
- **`components/TableSeatWheel.tsx` généralisé** : `highlightedIndex: number | null` devient `highlightedIndices: number[]` (plusieurs sièges à la fois), utilisé par `/plan-table` et le nouveau panneau de `GuestArrivalPanel`.
- **Le bouton "📷 Invité surprise" devient une icône caméra à côté du "+"** dans `GuestArrivalPanel` (au lieu d'un gros bouton séparé plus bas sur la page), avec un nouveau bouton "Terminé" qui ramène à `/scan` — les deux fonctionnalités (ajout direct, parcours photo) restent strictement inchangées, seule leur présentation change.

### Tests
- `tests/table-seat-wheel.test.ts` (2 nouveaux tests) : `highlightedIndices` sur `TableSeatWheel`, rendu du dessin dans `GuestArrivalPanel`.
- `tests/floor-plan-seats.test.ts` (1 nouveau test) : surlignage multi-sièges depuis la liste d'invitations de `/plan-table`.
- `tests/guest-approval-linked-invitation.test.ts`, `tests/guest-arrival-panel.test.ts` : mis à jour pour la nouvelle disposition +/caméra/Terminé.

### Migrations
- Aucune (changements purement client, la vraie source de placement reste `invitations.table_id`).

Version: 1.48.4 → 1.48.5

## [1.48.4] — 2026-09-14

Badge numérique sur l'icône de l'app (écran d'accueil), avant même de l'ouvrir — demande de Gersom après avoir activé les notifications Push.

### Ajouté
- **`lib/appBadge.ts`** (nouveau) : `syncAppBadge`/`clearAppBadge`, enveloppe best-effort autour de la Badging API (`navigator.setAppBadge`/`clearAppBadge`), supportée par les PWA installées sur l'écran d'accueil depuis iOS 16.4. Distinct du badge déjà affiché à l'intérieur de l'app (`AccountMenu`/`BottomNav`/`GuestApprovalsShortcut`), visible uniquement une fois ouverte.
- **`public/sw.js`** : le gestionnaire `push` lit désormais `badgeCount` dans le payload et appelle `setAppBadge`/`clearAppBadge` en tâche de fond, en plus d'afficher la notification — fonctionne même si l'app n'est pas ouverte, exactement le scénario demandé ("le petit 1 indicateur sur l'icône avant de l'ouvrir").
- **`lib/webPush.ts`** : `notifyGuestApprovalReviewers` calcule et envoie `badgeCount` (même compte que `pending_count`, déjà utilisé par le badge interne).
- **`AccountMenu`/`BottomNav`/`GuestApprovalsShortcut`** : chaque sondage du compte d'approbations en attente recale aussi le badge de l'icône (`syncAppBadge`) — corrige/efface le badge dès que l'app est rouverte, sans attendre un futur Push. Le badge est explicitement effacé à la déconnexion (`AccountMenu`), un appareil pouvant changer de compte.

### Tests
- `tests/app-badge.test.ts` (nouveau, 5 tests) : comportement de `syncAppBadge`/`clearAppBadge` (appel correct selon le compte, jamais d'exception si l'API est absente ou rejette).
- `tests/guest-approvals.test.ts` (4 nouveaux tests) : câblage bout en bout — le serveur envoie `badgeCount`, le service worker le lit et appelle la Badging API, les trois sondeurs en premier plan le recalent, le badge est effacé à la déconnexion.

### Migrations
- Aucune (changement purement client + une donnée supplémentaire dans un payload Push déjà existant).

Version: 1.48.3 → 1.48.4

## [1.48.3] — 2026-09-14

Bug signalé par Gersom : le bouton reste sur « … » très longtemps en approuvant/reconsidérant/assignant une table + désactivation intentionnelle de Twilio via un interrupteur explicite.

### Corrigé
- **Approuver/reconsidérer/assigner une table restait bloqué sur « … » très longtemps** — root cause (suivi `docs/QE_QA_PROCESS.md`) : `finalizeDecision` (`lib/guestApprovalDecide.ts`, partagée par la décision normale, `/approve/[token]`, WhatsApp entrant et la reconsidération) et `app/api/guest-approvals/[id]/assign-table/route.ts` attendaient chacun deux envois indépendants documentés « best-effort » (SMS/WhatsApp de confirmation, Push aux placeurs, rapport SMS aux directeurs de festin) en séquence et sans aucune limite de temps avant de répondre à l'agent. Corrigé une seule fois pour tous les appelants : `lib/twilio.ts` borne chaque requête HTTP Twilio à 8s (`AbortSignal.timeout`), `lib/webPush.ts` borne chaque envoi Push à 8s (option `timeout` native de `web-push`), et les deux envois indépendants de chaque route tournent désormais en parallèle (`Promise.allSettled`) plutôt qu'en séquence.

### Ajouté
- **`TWILIO_ENABLED`** (`lib/twilio.ts`, `isTwilioEnabled()`) : interrupteur explicite pour Twilio (SMS + WhatsApp), désactivé par défaut — demande de Gersom : Twilio reste volontairement « toggle off » pour l'instant, activation prévue plus tard. Centralisé dans `getTwilioConfig`/`getWhatsAppConfig` : `sendSms`/`sendWhatsApp` et tous leurs appelants (`lib/guestApprovalNotify.ts`) s'adaptent automatiquement à l'état du toggle sans aucun changement de code ailleurs. Réactiver plus tard ne demande qu'une seule variable d'environnement (`TWILIO_ENABLED=true`, en plus des identifiants `TWILIO_*`), voir `DEPLOIEMENT.md`. Tant que désactivé, aucune requête réseau Twilio n'est même tentée — la création/décision/assignation d'un invité surprise reste entièrement fonctionnelle depuis l'application, seule la notification externe (approbateur, directeur de festin) ne part pas.

### Tests
- `tests/guest-approvals.test.ts` (5 nouveaux tests) : timeouts Twilio/Push bornés à quelques secondes, envois indépendants lancés en parallèle (`finalizeDecision`, `assign-table`), et comportement du toggle `TWILIO_ENABLED` vérifié par test comportemental (aucune requête réseau tentée quand désactivé, réactivation sans changement d'appel une fois `TWILIO_ENABLED=true` posé).

### Migrations
- Aucune (changements de code + une nouvelle variable d'environnement optionnelle, désactivée par défaut).

Version: 1.48.2 → 1.48.3

## [1.48.2] — 2026-09-14

Remplacement du panneau « Vu sur le plan photographié » de `/plan-table` : un vrai dessin de table (façon seatplan.io) au lieu d'une grille de boutons.

### Changé
- **`components/TableSeatWheel.tsx` (nouveau)** : dessin SVG circulaire d'une table — dix étiquettes de siège rayonnant autour d'un cercle central numéroté, dans le sens horaire depuis le haut, chacune tournée à son propre angle (même mécanisme `rotate()` que les libellés de `components/FloorPlan.tsx`), fidèle aux photos seatplan.io transmises par Gersom (y compris les étiquettes du bas, qui se retrouvent donc la tête en bas — aucune correction de lisibilité). Remplace l'ancienne grille de boutons (`grid grid-cols-2`) sur `/plan-table`.
- **Sièges vides** rendus visuellement distincts (contour pointillé, libellé « Vide »).
- **Mise en évidence d'un siège** : reprend l'état `highlightedSeat` existant (introduit en v1.48.0) — toucher un nom bascule sa surbrillance (couleurs accent), comme sur l'exemple de carte nominative numérique montré par Gersom.
- `app/plan-table/page.tsx` : même conteneur `.card` et même texte informatif (complété d'« Touchez un nom pour mettre son siège en évidence. »), seul le contenu du panneau change — toujours purement informatif, `lib/floorPlanSeats.ts` inchangé et reste la seule source de ces noms (jamais `invitations.table_id`).

### Tests
- `tests/table-seat-wheel.test.ts` (nouveau) : le composant exporte `TableSeatWheel`, rayonne via `rotate()` (pas de grille de boutons), distingue les sièges vides, met en évidence le siège sélectionné, ne fait aucun appel réseau/Supabase ; `/plan-table` rend bien `<TableSeatWheel>` avec les bonnes props.
- `tests/floor-plan-seats.test.ts` : inchangé et toujours au vert (aucune donnée modifiée, seul le rendu change).

### Migrations
- Aucune (changement purement visuel côté client).

Version: 1.48.1 → 1.48.2

## [1.48.1] — 2026-09-14

Correctif de la refonte du plan de salle (v1.48.0) : les zones nord et sud étaient inversées.

### Corrigé
- **Zones nord/sud inversées sur `/plan-table`** : retour de Gersom (capture d'écran de l'app) — la zone à 22 tables (celle contenant la paire 22/23) doit être au **nord** (en haut), pas au sud, et la grille 5×4 « propre » (20 tables) doit être au **sud** (en bas). Corrigé dans `components/FloorPlan.tsx` en permutant uniquement la bande de rangées Y de chaque bloc (mêmes colonnes X qu'avant pour chaque table, donc même alignement et mêmes voisins) — aucune position n'a été redevinée, seul le bloc entier change de bande verticale. La paire 22/23 (première colonne du bloc nord, rangées 1-2) se retrouve ainsi bien au nord-ouest, comme demandé. Les en-têtes de zone (`FLOOR_PLAN_ZONE_LABELS`) n'ont pas eu besoin de changer : leur position dépendait déjà de la bande Y (haut/bas), pas des tables qui s'y trouvent.

### Tests
- `tests/floor-plan.test.ts`, `tests/floor-plan-seats.test.ts` : inchangés et toujours au vert (la couverture/le nombre de tables ne changent pas, seule leur position bascule).

### Migrations
- Aucune (changement purement visuel côté client).

Version: 1.48.0 → 1.48.1

## [1.48.0] — 2026-09-14

Refonte du plan de salle interactif selon la nouvelle configuration de zones (photos transmises par Gersom), + surbrillance optionnelle des sièges par table.

### Ajouté
- **`components/FloorPlan.tsx` redessiné en deux zones (nord/sud)** reproduisant fidèlement l'ordre et le voisinage des tables sur les deux photos zoomées transmises par Gersom : zone nord (5 colonnes × 4 rangées) et zone sud (6 colonnes × 4 rangées, avec la zone "Piste et File Attente" de la photo laissée vide — déjà représentée par la salle "Piste de danse" existante). Les 42 tables sont désormais toutes positionnées sur le plan, y compris la nouvelle table 42 (« Johannesburg »). Extraction par OCR (crops zoomés de chaque table) croisée avec deux sources indépendantes pour éviter toute erreur silencieuse (`docs/DATA_CHANGE_INSTRUCTIONS.md` section 6) : les tags `T0xx`/`F0xx` de `guest-list_48.csv` et l'arithmétique de couverture complète (42 tables sans doublon ni trou). Deux en-têtes de zone purement décoratifs ajoutés (`FLOOR_PLAN_ZONE_LABELS`).
- **`lib/floorPlanSeats.ts`** : noms de sièges lus par OCR sur les deux photos (ordre horaire depuis midi, tel que sur chaque photo), **purement informatif** — jamais une source de placement (qui reste `invitations.table_id`). Recoupé avec la base : ~87 % des noms nommés retrouvent une invitation existante (même table, table différente si réorganisée depuis, ou parmi les 19 invitations ajoutées sans table en v1.47.0) — cette validation croisée a d'ailleurs permis de retrouver l'orthographe exacte de plusieurs noms mal lus par l'OCR initial (ex. « Jean-Ciben Ca ous » → « Jean-Clivens Le Caous », confirmé en base).
- **`/plan-table` : panneau « Vu sur le plan photographié »** sous la fiche de la table sélectionnée — liste ses 10 sièges (vides ou nommés), chacun togglable en surbrillance (état local uniquement, jamais envoyé au serveur, réinitialisé à chaque changement de table).

### Corrigé
- **Bug réel trouvé en recroisant l'OCR avec les positions déjà commitées** : la rangée 4 de la zone nord assignait par erreur les tables 10/16/17/9 aux mauvaises colonnes (`1, 10, 16, 17, 9` au lieu de `1, 9, 10, 16, 17`) — corrigé après re-vérification photo par photo.

### Non fait dans ce lot
- Le plan reste une reconstruction approximative au pixel près (redessinée à la main, jamais une trace exacte) — seul l'ordre/voisinage relatif de chaque photo est repris fidèlement.
- Aucune réassignation de `invitations.table_id` déduite de ce travail : les 15 écarts entre le plan photographié et la base actuelle (ex. « Furty Matuba » photographiée table 18, actuellement table 37 en base) sont volontairement **non appliqués** — hors périmètre de ce lot, à traiter séparément si Gersom le demande.

### Tests
- `tests/floor-plan.test.ts` : 42 tables (au lieu de 41).
- `tests/floor-plan-seats.test.ts` (nouveau) : couverture des 42 tables, table 42 vide, pas de source de placement, panneau `/plan-table`, réinitialisation de la surbrillance.

### Migrations
- Aucune (changement purement visuel/informatif, aucune écriture Supabase).

Version: 1.47.0 → 1.48.0

## [1.47.0] — 2026-09-14

Mise à jour ciblée du fichier d'invités (`guest-list_48.csv`, export With Joy le plus récent transmis par Gersom, "tu as tous les droits... on ne change pas toute la base, juste quelques changements") + nouvelle table 42 excédentaire.

### Ajouté
- **Table 42 « Johannesburg »** : nouvelle et unique table de réserve (capacité 10, identique aux autres) — la table 41 (« Houston ») devient une table régulière. Nouvelle structure : 42 tables au total, 410 places officielles, 420 places absolues avec réserve (`supabase/migrations/0051_table_42_johannesburg_reserve.sql`, appliquée et vérifiée en production le 14/09/2026).
- **19 nouvelles invitations** identifiées dans `guest-list_48.csv` sans correspondance en base (recherche par nom, exacte puis approchée, conformément à `docs/DATA_CHANGE_INSTRUCTIONS.md` section 6) : ajoutées avec leurs coordonnées de contact, **sans table assignée**. Le plan de table photographié transmis par Gersom (nouvelle configuration, tables reflétées par ses photos) montre des occupants différents de ceux actuellement en base pour plusieurs tables cibles (ex. table 29) — une réorganisation complète des places existantes n'était pas dans le périmètre de cette demande ("on ne change pas toute la base") ; la table déduite de la photo est conservée dans les notes de chaque invitation pour référence future, jamais devinée silencieusement pour un placement effectif.
- **Tantine Angèle Lukau** ajoutée avec `ne_viendra_pas = true` d'emblée (RSVP décliné dans le CSV), pour un rappel possible plus tard ("on va juste les envoyer après, probable" — retour de Gersom), plutôt que simplement omise.

### Modifié
- **Rafraîchissement des coordonnées de contact** (téléphone/email) pour 201 invitations déjà présentes en base, dont le nom correspond exactement à une ligne du CSV — aucune autre colonne touchée (nombre prévu/arrivé, table, statut, historique).
- **Ralph Momene et Bergine Momene marqués `ne_viendra_pas = true`** (déjà réunis dans l'invitation "Famille Momene" en base) : confirmé explicitement non-venants par Gersom.
- Capacité officielle 400 → 410, capacité absolue 410 → 420 partout dans le code (`lib/withjoyImport.ts`, `app/plan-table/page.tsx`, `app/admin/import-withjoy/page.tsx`, `app/dashboard/page.tsx`, `components/CapacityGauge.tsx`) et la documentation (`docs/BUSINESS_RULES.md`, `docs/DATA_AND_FORMS.md`, `docs/DATA_CHANGE_INSTRUCTIONS.md`, `docs/QA_SCENARIOS.md`, `docs/VERSIONING.md`, `CLAUDE.md`, `README.md`, `DEPLOIEMENT.md`, `ASSIGNATION_TABLES.md`).

### Corrigé
- **Bug réel trouvé pendant cette revue** : `app/approbations/[id]/assign/page.tsx` donnait la priorité de placement à la table portant le numéro `41` en dur (`usage.table.number === 41`), qui était jusqu'ici la seule table de réserve — désormais que la 41 est une table régulière (« Houston ») et que la réserve est la 42 (« Johannesburg »), ce code aurait fait passer Houston avant la vraie réserve dans la liste de placement rapide. Corrigé en `=== 42`.

### Non fait dans ce lot (hors périmètre explicite de la demande)
- Redessiner le plan de salle interactif (`components/FloorPlan.tsx`) selon la nouvelle configuration de zones communiquée par Gersom (20 tables sud, 22 tables nord en 5 rangées de 4 + 2 tables ouest) : le plan photographié transmis est plus fiable que l'ancien PDF basse résolution, mais son OCR n'est pas encore assez sûr pour redessiner ce schéma en confiance sans risque d'erreur sur de vrais noms — la table 42 n'apparaît donc pas encore sur ce plan visuel (elle reste pleinement fonctionnelle partout ailleurs).
- Surbrillance des chaises par personne (explicitement laissée à la discrétion de l'agent par Gersom) : pas encore implémentée, pour la même raison de fiabilité OCR.
- Réassignation des invitations déjà en base vers leur nouvelle table (si elle diffère) selon le plan photographié : explicitement hors périmètre ("on ne change pas toute la base, juste quelques changements").

### Tests
- `tests/withjoy-import.test.ts` : capacité totale mise à jour (420 au lieu de 410).
- `tests/guest-approvals.test.ts`, `tests/approbations-ux-improvements.test.ts` : assertions/titres alignés sur la table 42.

### Migrations
- `0051_table_42_johannesburg_reserve.sql` (déjà appliquée et vérifiée en production le 14/09/2026).

Version: 1.46.1 → 1.47.0

## [1.46.1] — 2026-09-14

Le bouton central d'agent_checkin devient Scan sur le tableau de bord, au lieu d'un aller-retour vers lui-même (retour de Gersom).

### Corrigé
- **Bouton doré = Scan, pas Bord, quand on est déjà sur `/dashboard`** : retour de Gersom sur Scotty Sanda (`agent_checkin`) : "quand on est dans le tableau de bord, je voudrais que le bouton doré en bas soit le bouton scan plutôt." Le bouton central d'`agent_checkin` (Bord, via `CENTRAL_HREF`) pointait vers `/dashboard` même en y étant déjà — un aller-retour inutile, exactement le même problème déjà corrigé pour admin/directeur le 02/09/2026. `agent_checkin` rejoint donc `isDirectorStyleNav` (`components/BottomNav.tsx`) : Scan au centre sur `/dashboard`/`/scan`/`/agenda` (jamais l'appareil photo, ce rôle n'a pas `submitGuestApproval`), Bord au centre partout ailleurs — barre générique (`AGENT_CHECKIN_ITEMS`) inchangée.

### Tests
- `tests/placeur-director-nav.test.ts` : nouvelle assertion pour agent_checkin.

### Migrations
- Aucune.

Version: 1.46.0 → 1.46.1

## [1.46.0] — 2026-09-14

La navigation du placeur calque désormais le comportement contextuel de directeur (retour de Gersom).

### Corrigé
- **Nav du placeur alignée sur directeur** : Agent001 (rôle vérifié en base : bien `placeur`, pas `agent_checkin` comme les échanges précédents sur ce compte le suggéraient) affichait toujours l'ancienne barre (Scan au centre, Staff en dernier onglet), jamais retouchée alors que Staff avait déjà été remplacé par Approbations pour tous les autres rôles. Sur choix explicite de Gersom (calquer tout le comportement de directeur plutôt qu'un simple remplacement de dernier onglet) : `placeur` gagne désormais le même comportement contextuel que `directeur` dans `components/BottomNav.tsx` — Tableau de bord au centre hors `/dashboard`, `/scan` et `/agenda` (Scan reste alors un onglet latéral, il continue de scanner très régulièrement contrairement à `agent_checkin`), Scan/appareil photo au centre sur ces trois pages, Approbations remplace Staff en dernier onglet de la barre générique.
- **Nouvelle capacité `viewAgenda` pour placeur** (lecture seule, jamais `manageAgenda`, réservée à admin/directeur) : nécessaire pour que l'onglet Agenda désormais affiché sur `/dashboard`/`/scan`/`/agenda` soit réellement accessible (même principe que le `viewAgenda` d'`agent_checkin`, v1.40.0). `/staff` reste atteignable via le badge QR "STAFF" depuis `/scan` (`viewStaff` inchangée) — seul le raccourci permanent de la barre change.

### Tests
- Nouveau `tests/placeur-director-nav.test.ts`.
- `tests/permissions.test.ts` : assertion mise à jour (placeur gagne `viewAgenda`).
- `npx tsc --noEmit`, `npm run build`, tous les tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

### Migrations
- Aucune.

Version: 1.45.2 → 1.46.0

## [1.45.2] — 2026-09-13

En paysage, la barre gestuelle système (iPad) ne recouvre plus le dernier contenu ni le dernier onglet (retour de Gersom).

### Corrigé
- **"L'app fixée même quand on met en horizontal"** : en paysage sur iPad (barre gestuelle système horizontale même une fois l'écran tourné, contrairement à l'iPhone où elle se retrouve sur un côté), le dernier contenu visible d'une page (ex. la dernière rangée de tables sur `/plan-table`) et le dernier onglet de la barre de navigation verticale pouvaient se retrouver recouverts par cette barre système. `.bottom-nav-glass` réserve déjà cet espace en portrait (`margin-bottom`), mais la remet explicitement à 0 en paysage (elle devient une bande verticale, protégée seulement du côté `safe-right`) — rien ne protégeait le bord du bas. Probablement masqué avant `fixed inset-0` (v1.45.0) par un calcul `h-dvh` qui excluait déjà cette zone dans certains cas ; exposé une fois le viewport réel utilisé directement.
- Corrigé en réduisant le rectangle de la coquille de chaque page en paysage (`landscape:bottom-[env(safe-area-inset-bottom)]` au lieu de `bottom-0`), qui protège d'un coup le contenu ET le dernier onglet de la barre verticale — aucun padding à ajouter dans les 11 pages individuellement.

### Tests
- `tests/scroll-fixed-shell.test.ts` : nouvelle assertion + mise à jour de l'assertion existante.

### Migrations
- Aucune.

Version: 1.45.1 → 1.45.2

## [1.45.1] — 2026-09-13

Le bouton de compte flottant ne recouvre plus la navigation en paysage (retour de Gersom).

### Corrigé
- **"Les deux SS qui vont par-dessus le bouton recherche"** : sur `/scan` et `/placement` (les deux seuls écrans sans TopBar, utilisant `AccountMenu floating` via `components/UserMenu.tsx`), le bouton de compte restait ancré en haut à droite du viewport quelle que soit l'orientation — en paysage, la barre de navigation devient une bande verticale collée à ce même bord droit (`components/BottomNav.tsx`), et les deux se superposaient, recouvrant le premier onglet (Recherche). Le bouton bascule désormais à gauche uniquement en paysage (portrait inchangé) ; son panneau déroulant s'ouvre vers la droite dans ce cas pour rester à l'écran. La bannière "Nouvelle approbation" du même composant, qui passait sous cette même bande en paysage, s'arrête désormais avant elle.
- Aucun changement pour l'usage non flottant (`TopBar`, toutes les autres pages) : déjà correctement calé par le flux flex, jamais touché par ce bug.

### Tests
- Nouveau `tests/account-menu-landscape.test.ts`.
- `npx tsc --noEmit`, `npm run build`, tous les tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

### Migrations
- Aucune.

Version: 1.45.0 → 1.45.1

## [1.45.0] — 2026-09-13

Navigation d'agent_checkin réorganisée (Tableau de bord au centre, Agenda + Approbations) et écran vraiment figé pendant le défilement (retour de Gersom).

### Corrigé
- **Navigation agent_checkin (Agent001, Ruben Lopez...)** : "les agents scan sont là seulement pour scanner, pas pour approuver — s'il y a un problème ils redirigent vers le placeur qui fait la photo." La barre du bas devient Recherche, Plan, **Tableau de bord** (gros bouton central), Agenda, Approbations — Scan n'a plus d'onglet dédié : `/scan` reste sa page d'atterrissage par défaut et reste joignable depuis Approbations (flèche Retour du TopBar) ou, via Dashboard, depuis Agenda.
- **"Ça ne reste pas figé" pendant le défilement, bouton central injoignable après** : deux causes trouvées.
  1. `hooks/usePullToRefresh.ts` (utilisé par `/dashboard`) gardait "seulement en haut de page" avec `window.scrollY <= 0` — structurellement toujours vrai dans cette application (page ancrée, seul un `<div overflow-y-auto>` interne défile) : le garde-fou ne protégeait donc jamais rien, et le geste "tirer pour actualiser" pouvait se déclencher, et rester bloqué (aucun `touchcancel`), au milieu d'un défilement normal, décalant la mise en page en dessous. Corrigé en vérifiant le `scrollTop` du vrai conteneur défilant (comme `/plan-table` le faisait déjà) et en réinitialisant sur `touchcancel`.
  2. Chaque écran principal passe de `h-dvh` seul à **`fixed inset-0`** : ancré directement au viewport réel plutôt que dépendant d'un recalcul de hauteur dynamique pendant qu'une barre d'outils système (Safari iOS) apparaît/disparaît en cours de défilement — "make it really fixed like in an app". Aucun changement du flex interne : `BottomNav` garde exactement la même place, aucun padding à ajouter nulle part.

### Tests
- Nouveau `tests/scroll-fixed-shell.test.ts`.
- `tests/navigation-resilience.test.ts`, `tests/approbations-ux-improvements.test.ts` : assertions mises à jour pour le nouveau layout d'agent_checkin.
- `npx tsc --noEmit`, `npm run build`, tous les tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

### Migrations
- Aucune.

Version: 1.44.0 → 1.45.0

## [1.44.0] — 2026-09-13

Reconsidérer un refus place désormais l'invité sur une table choisie, avant l'approbation (retour de Gersom).

### Corrigé
- **Reconsidérer un refus permet de choisir la table d'abord** : "Reconsidérer → Approuver" (liste et fiche détaillée de `/approbations`) ne décide plus directement — le bouton mène désormais à `/approbations/[id]/assign` (nouveau mode "reconsider"), où l'agent choisit la table avant que la demande soit approuvée. Avant ce correctif, l'approbation était immédiate et le placement automatique (`auto_assign_table_for_guest_approval`, 0045) choisissait seul la table, sans intervention possible — retour de Gersom : "je n'avais pas l'option de le mettre sur une table... le process a été automatique".
- **Nouvelle route `POST /api/guest-approvals/[id]/reconsider-assign`** : réserve la table choisie (`reserve_table_for_guest_approval`) puis approuve (`allowReconsiderFromRefused`) en une seule action — `finalizeDecision` (lib/guestApprovalDecide.ts) détecte la réservation posée et la finalise en vraie assignation, exactement comme une réservation posée avant décision (0044). Si la réservation échoue (table pleine entre-temps), rien n'est décidé : la demande reste refusée. Exige `reviewGuestApproval` ET `assignGuestApproval` (admin, directeur, visibilite).

### Migrations
- `0050_reserve_table_for_reconsidered_refusal.sql` : `reserve_table_for_guest_approval` (0044) accepte désormais aussi le statut `refuse`, pas seulement `en_attente` — une demande refusée n'a jamais de `reserved_table_id` restant en place (libérée automatiquement au refus), donc aucun risque de collision. Appliquée et vérifiée en production Supabase le 13/09/2026.

### Tests
- `tests/approbations-ux-improvements.test.ts` : nouveaux tests sur le mode "reconsider", la nouvelle route et la migration 0050.
- `tests/guest-approval-reservation.test.ts` : assertions sur les trois modes de `/approbations/[id]/assign` mises à jour (au lieu de deux).
- `npx tsc --noEmit`, `npm run build`, tous les tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

Version: 1.43.1 → 1.44.0

## [1.43.1] — 2026-09-13

Précision du bouton "Activer les notifications" (retour de Gersom).

### Corrigé
- **Instructions précises au lieu d'un message générique** : un refus de notifications (ou, sur iOS, l'app pas encore installée sur l'écran d'accueil) affiche désormais le chemin exact à suivre dans les réglages du téléphone (iOS/Android détectés séparément), au lieu d'un simple "à configurer" sans marche à suivre.
- **Précision technique documentée dans le code** : aucune API web ne permet d'ouvrir directement les réglages système de notifications d'une PWA, ni sur iOS ni sur Android — contrairement à la caméra (`getUserMedia`), qui affiche sa propre invite native depuis la page elle-même. C'est une restriction de plateforme (WebKit/Android), pas un choix de ce code ; les instructions pas-à-pas sont le meilleur substitut possible.

### Tests
- Nouveau `tests/push-notification-instructions.test.ts`.
- `npx tsc --noEmit`, `npm run build`, tous les tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

### Migrations
- Aucune.

Version: 1.43.0 → 1.43.1

## [1.43.0] — 2026-09-13

Deuxième lot du jour (retour de Gersom, 5 photos) sur les approbations, le plan de salle et le check-in.

### Corrigé
- **Refus reconsidérable** : une demande refusée par erreur peut désormais être reconsidérée et approuvée depuis l'application (liste et fiche détaillée) — jamais l'inverse (une approbation peut déjà avoir une table assignée), et jamais depuis le lien public `/approve/[token]` ni WhatsApp.
- **Flash résiduel de `GuestArrivalPanel`** ("la photo 3 arrive, reste quelques millisecondes, puis la photo 2 arrive", surtout depuis `/plan-table`) : la branche de secours "ensure" (backfill générique d'une invitation jamais encore matérialisée) ne marquait pas `initializing=true` avant son propre appel réseau, contrairement à la branche "initialize" juste au-dessus — une fenêtre où `settled` devenait vrai avec `visible=false`, suffisante pour faire flasher l'ancien compteur `+/-`.
- **Pincement cassé sur `/plan-table` après rotation** ("les zooms... disparaissent, je ne peux plus pinch") : le geste de tire-pour-rafraîchir (Touch Events, `touches[0]` seul) vivait sur le même conteneur défilant que le plan de salle (Pointer Events) et interceptait les gestes à deux doigts. Les deux gestionnaires ignorent désormais tout geste à plus d'un doigt.

### Ajouté
- **Swipe pour supprimer** une demande déjà décidée (approuvée ou refusée) sur `/approbations`, réservé à l'admin (`components/SwipeableDeleteCard.tsx`, nouvelle route `DELETE /api/guest-approvals/[id]` qui refuse toute demande encore `en_attente`).
- **Texte de `/approbations/[id]/assign` raccourci** : un badge "Automatique"/"Sélectionnée" remplace le paragraphe détaillant l'ordre de priorité des tables.
- **agent_checkin voit désormais Approbations** (lecture seule — jamais `reviewGuestApproval` ni `assignGuestApproval`, ce rôle continue de renvoyer vers un placeur) en dernier onglet, à la place d'Agenda ; l'agenda du jour reste visible sur `/scan` via `NextAgendaActivity` (déjà affiché pour ce rôle, pas besoin d'onglet dédié pour les deux).

### Tests
- `tests/approbations-ux-improvements.test.ts` complété ; `tests/guest-approvals.test.ts` et `tests/navigation-resilience.test.ts` mis à jour.
- `npx tsc --noEmit`, `npm run build`, tous les tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

### Migrations
- Aucune.

Version: 1.42.1 → 1.43.0

## [1.42.1] — 2026-09-13

Ajustement mineur du badge de version sur le splash (retour de Gersom).

### Corrigé
- **Badge de version du splash déplacé** : "c'est trop en bas à droite" — décalé d'environ 1 cm à l'angle 315° (cap boussole, donc vers le nord-ouest/le centre) via un `transform: translate(-0.71cm, -0.71cm)`, en gardant l'ancrage `bottom-3 right-4` existant. Toujours synchronisé automatiquement avec `package.json` (aucun changement sur ce point, déjà en place depuis v1.40.0 — reconfirmé par ce lot).

### Tests
- `tests/navigation-resilience.test.ts` mis à jour (nouvelle assertion sur le `transform`).
- `npx tsc --noEmit`, `npm run build`, tous les tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

### Migrations
- Aucune.

Version: 1.42.0 → 1.42.1

## [1.42.0] — 2026-09-13

Lot de 8 correctifs/fonctionnalités demandés par Gersom (retour avec 4 photos) sur les approbations, la navigation et le check-in.

### Corrigé
- **Bug critique : Approuver/Refuser ne faisait rien dans l'application** ("La décision n'a pas pu être enregistrée. Vérifiez le réseau et réessayez.") — root-cause identifiée par reproduction en base : la contrainte `guest_approval_requests_decided_via_check` en production n'autorisait que `'web'`/`'whatsapp'`, jamais `'app'`, alors que `POST /api/guest-approvals/[id]/decide` envoie toujours `'app'`. La migration `0037_guest_approval_app_push.sql` (déjà dans le dépôt, jamais appliquée en production) corrige exactement ça — **appliquée en production le 13/09/2026**, avec au passage `push_subscriptions` (table manquante depuis le début, rendant les notifications Web Push muettes) et `0036_enable_rls_user_credential_backups.sql` (RLS manquante, signalée par l'advisor Supabase, table inutilisée par le code). Vérifié par une transaction de test (BEGIN/ROLLBACK) sur une vraie demande en attente avant et après.
- **Flash de l'ancien compteur `+/-` dans `GuestArrivalPanel`** en changeant d'invitation (ex: solo → groupe) : le composant réutilisé par Next.js gardait l'état `loading`/`members` de l'invitation précédente le temps que la nouvelle requête arrive. Réinitialisé synchroniquement au changement d'`invitation.id`, avec un `onVisibilityChange(true)` optimiste (même logique que le correctif du 03/09/2026 sur la page parente).

### Ajouté
- **Bottom nav** : Approbations remplace Agenda (barre générique admin/directeur, hors `/dashboard`/`/scan`/`/agenda`) et Staff (visibilite) en dernière position — accès direct aux approbations pour les rôles qui en ont la capacité, Agenda restant atteignable depuis `/dashboard`, `/scan` et `/agenda` lui-même.
- **`/checkin/[invitationId]`** : le bloc "Table N" et l'étiquette `T0XX` correspondante sont cliquables vers `/tables/[tableId]`.
- **Caméra en direct pour "📷 Invité surprise"** (`components/PhotoCaptureCamera.tsx`, `getUserMedia` + capture canvas, même mécanisme que `QrScanner.captureFrame` sur `/scan`) — remplace un `<input capture>` qui ouvrait l'app Camera native et faisait quitter l'application.
- **"Arrivé(e) avec"** (invitation liée, `linked_invitation_id`) affiché dans la liste et la fiche détaillée de `/approbations`, et sur `/approbations/[id]/assign` où sa table est désormais **présélectionnée automatiquement** en priorité (avant même la table 41), tout en restant modifiable en touchant une autre table.
- Fiche détaillée de `/approbations` resserrée (photo 42dvh → 26dvh, marges réduites) pour tenir sans défiler.

### Tests
- Nouveau `tests/approbations-ux-improvements.test.ts` (bottom nav, flash, tag cliquable, caméra, linked_invitation, présélection).
- `tests/guest-approval-linked-invitation.test.ts`, `tests/guest-approvals.test.ts` mis à jour (nouvelles valeurs 26dvh / priorité table).
- `npx tsc --noEmit`, `npm run build`, tous les tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

### Migrations
- Aucune nouvelle migration écrite : `0036_enable_rls_user_credential_backups.sql` et `0037_guest_approval_app_push.sql`, déjà présentes dans le dépôt depuis longtemps, ont été appliquées en production pour la première fois (voir ci-dessus).

Version: 1.41.3 → 1.42.0

## [1.41.3] — 2026-09-04

Suite de la v1.41.2 : le commentaire de suppression CodeQL documenté par GitHub (`codeql[js/xss-through-dom]`) sur `components/GuestApprovalCaptureFlow.tsx` n'avait en réalité aucun effet — confirmé empiriquement sur PR #68 avec deux placements essayés (ligne précédente isolée, commentaire de fin de ligne), l'alerte étant relevée à l'identique aux deux scans suivants. Ce repo utilise le Default setup de GitHub pour CodeQL (aucun `.github/workflows/*codeql*` versionné), qui ne semble pas traiter ces commentaires de suppression inline comme le ferait un Advanced setup. Gersom a rejeté l'alerte manuellement (faux positif) dans l'onglet Security → Code scanning de GitHub.

### Corrigé
- **Nettoyage du commentaire de suppression inefficace** : `components/GuestApprovalCaptureFlow.tsx` ne porte plus le commentaire `codeql[js/xss-through-dom]` (sans effet, trompeur) ; le garde-fou `safePreview` (seule protection ayant un effet réel, même non reconnue par CodeQL comme sanitizer) reste inchangé, avec un commentaire qui documente l'historique complet et le rejet manuel de l'alerte.
- `tests/guest-approval-linked-invitation.test.ts` : le test de régression ne vérifie plus la présence du commentaire de suppression (retiré), seulement le garde-fou de type.

### Tests
- `npx tsc --noEmit`, `npm run build`, 218 tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

### Migrations
- Aucune.

Version: 1.41.2 → 1.41.3

## [1.41.2] — 2026-09-04

Suite immédiate de la v1.41.1 : le commit contenant le garde-fou `safePreview` a été fusionné (PR #67) avant que le second commit — la suppression CodeQL documentée qui règle réellement l'alerte — n'ait fini de se propager, donc `main` s'est retrouvé avec le correctif incomplet (le garde-fou seul ne suffit pas, CodeQL ne reconnaît pas `.startsWith()` comme un sanitizer pour `js/xss-through-dom`, confirmé par le check CodeQL toujours en échec sur ce commit).

### Corrigé
- **Le commit manquant de la v1.41.1 est maintenant sur `main`** : le commentaire de suppression documenté par GitHub (`codeql[js/xss-through-dom]`) sur `components/GuestApprovalCaptureFlow.tsx`, avec la justification inline (URL `blob:` locale même origine, jamais de markup attaquant, `<img src>` n'exécute aucun script) et son test de régression.

### Tests
- `npx tsc --noEmit`, `npm run build`, 218 tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

### Migrations
- Aucune.

Version: 1.41.1 → 1.41.2

## [1.41.1] — 2026-09-04

Alerte CodeQL ("DOM text reinterpreted as HTML") sur `components/GuestApprovalCaptureFlow.tsx` — l'aperçu de la photo capturée (`preview`, un état React alimenté par `URL.createObjectURL`) était rendu directement comme `src` d'`<img>`. En pratique `preview` ne peut jamais être autre chose qu'une URL `blob:` locale, mais l'analyse statique ne peut pas le prouver à partir du seul type `string`.

### Corrigé
- **Garde-fou explicite sur l'aperçu photo** : `safePreview` ne laisse passer que les valeurs commençant par `blob:` avant de les rendre comme `src` — rend la contrainte vérifiable statiquement (satisfait CodeQL) sans changer le comportement (la valeur était déjà toujours une URL blob: locale en pratique).

### Tests
- `tests/guest-approval-linked-invitation.test.ts` : nouveau test vérifiant le garde-fou `safePreview` et l'absence de `<img src={preview}>` non filtré.
- `npx tsc --noEmit`, `npm run build`, 218 tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

### Migrations
- Aucune.

Version: 1.41.0 → 1.41.1

## [1.41.0] — 2026-09-03

Retour de Gersom : quand l'événement est plein, approuver un invité surprise ne permettait pas de le placer sur une table — l'écran d'assignation ne proposait que les tables avec assez de places libres et le RPC refusait tout dépassement (`target_capacity_exceeded`), l'invité approuvé restait sans table.

### Ajouté
- **Forçage d'assignation sur une table pleine** (`supabase/migrations/0049_force_assign_guest_approval.sql`, paramètre `p_force` ajouté à `assign_table_to_guest_approval_strict`, comportement strict par défaut inchangé) : un placeur/directeur/admin peut désormais forcer l'invité approuvé sur la table choisie même au-delà de sa capacité (une chaise en plus, même philosophie qu'un déplacement, migration 0008). Une réorganisation éventuelle reste possible mais ses destinations restent strictes — on ne déplace jamais quelqu'un vers une autre table déjà pleine ; les arrivés ne sont jamais déplacés. Le forçage est tracé dans `audit_logs` (`details.force = true`) pour rester réconciliable avec la capacité officielle (400 places / absolue 410).
- **Toggle « Forcer le placement » sur `/approbations/[id]/assign`** (`app/approbations/[id]/assign/page.tsx`) : quand aucune table n'a assez de places, l'agent bascule en « toutes les tables » et peut valider sans réorganisation complète. L'erreur `target_capacity_exceeded` renvoie explicitement vers ce toggle. `app/api/guest-approvals/[id]/assign-table/route.ts` transmet `p_force` au RPC.
- `tests/guest-approval-force-assign.test.ts` : 3 tests — l'écran propose le forçage, l'API transmet `p_force`, la migration 0049 permet le forçage sans casser le comportement strict.

### Corrigé
- `tests/navigation-resilience.test.ts` : la fenêtre de caractères `{0,200}` avant `<TopBar>` sur `/tables/move-multiple` était trop serrée depuis l'ajout du commentaire explicatif du correctif flash (2 lignes) — élargie à `{0,400}`.

### Tests
- Nouveau `tests/guest-approval-force-assign.test.ts` (3 tests).
- `tsc --noEmit`, 23 fichiers de tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

### Migrations
- `0049_force_assign_guest_approval.sql` (appliquer en production : `p_force boolean default false` ajouté à `assign_table_to_guest_approval_strict`).

Version: 1.40.0 → 1.41.0


## [1.40.0] — 2026-09-03

Optimisations « jour J » de bout en bout (réseau, temps réel, batterie), pensées pour ~20 tablettes simultanées — et numéro de version désormais visible à l'ouverture de l'app.

### Ajouté
- **Numéro de version affiché sur le splash** (en bas à droite, ex. « v1.40.0 ») : la source unique est `package.json` (`version`), lu côté serveur au build par `app/page.tsx` et passé à `SplashScreen` — plus aucun doute sur la version déployée quand on ouvre l'app.

### Modifié — performance
- **Temps réel : delta appliqué localement** (`lib/realtimeDelta.ts`) : un check-in est un UPDATE d'une seule ligne ; le payload `postgres_changes` (~1 Ko) est désormais appliqué directement à l'état local de `/dashboard`, `/plan-table`, `/exceptions`, `/tables/[tableId]` (et l'ancienne route `/table/[tableId]`) et de `GuestArrivalPanel`, au lieu de re-télécharger toute la table (~100–300 Ko) sur chaque tablette ouverte. `INSERT`/`DELETE` (rares : réimport CSV) restent regroupés par debounce 400 ms. `GuestArrivalPanel` filtre en plus localement sa souscription sur `guests` (non filtrable par invitation côté serveur) : une édition d'un invité d'une autre invitation ne recharge plus le panneau.
- **Le polling se met en pause hors premier plan** (`hooks/usePolling.ts`) : les intervalles de `AccountMenu` (5 s), `GuestApprovalsShortcut` (5 s), `BottomNav` (15 s), `/staff` (10 s), `/agenda` (10 s) et `/approbations` (10 s) sont suspendus quand l'écran est verrouillé ou l'app en arrière-plan, et repris au retour — des dizaines de requêtes inutiles par minute en moins avec ~20 appareils.
- **Client Supabase navigateur en singleton** (`lib/supabase/client.ts`) : une seule instance par onglet au lieu d'une recréation à chaque chargement — les canaux Realtime ne se dupliquent plus.
- **`/search`** : le dataset complet n'est plus chargé à l'ouverture de la page, seulement quand l'agent bascule en mode « parcourir toutes les invitations », avec des colonnes réduites au strict nécessaire.
- **`/tables/move-multiple`** : une seule requête `Promise.all` au lieu de deux fetches séquentiels (les invitations sélectionnées sont un sous-ensemble du dataset, `usages` a besoin du dataset complet).
- **`xlsx` (~450 Ko) chargé à la demande** sur `/admin/import` et `/admin/diffusion`, uniquement quand un fichier est réellement ouvert.
- `next.config.js` : `poweredByHeader: false`.

### Tests
- Nouveaux `tests/realtime-delta.test.ts` et `tests/use-polling.test.ts` (delta par id, pause/reprise de l'intervalle sur `visibilitychange`).
- `tests/guest-approvals.test.ts` et `tests/agenda-form.test.ts` : assertions périmées alignées sur la source (elles échouaient déjà sur `main` avant ces changements).
- `tsc --noEmit` et 22 fichiers de tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

### Migrations
- Aucune.

Version: 1.39.2 → 1.40.0


## [1.39.2] — 2026-09-03

Retour de Gersom sur trois points (captures d'écran de `/approbations`, de la fiche « Lys Landu » et de « Membres du groupe » à l'appui) : le flash de navigation entre deux fiches d'une même route, le doublon d'ajout d'invité sur la fiche de check-in, et le plan de table qui ne semblait pas se mettre à jour.

### Corrigé
- **Flash de navigation ("l'ancienne page en premier, puis la nouvelle")** : Next.js réutilise la même instance de composant en passant d'une table (ou d'une fiche invité) à une autre au sein de la même route dynamique — sans réinitialisation explicite au début de l'effet gardé sur le paramètre d'URL, l'ancien contenu restait affiché intégralement pendant que la nouvelle requête était encore en vol. Corrigé sur `/table/[tableId]`, `/tables/[tableId]` (qui n'avait même pas d'état de chargement avant ce correctif), `/checkin/[invitationId]` et `/checkin/[invitationId]/members` : chacun réinitialise désormais son état (et re-affiche « Chargement… ») dès que le paramètre change, avant de relancer la requête.
- **Plan de table pas à jour après un ajout/placement** : conséquence directe du point suivant — un excédent ajouté via l'ancien "+" (`add_invitation_member`) n'était jamais marqué arrivé, donc `nombre_arrive` ne changeait jamais et `/plan-table` (déjà abonné en temps réel sur `invitations`/`tables`, aucun bug de son côté) n'avait simplement rien de nouveau à refléter. Résolu par la consolidation ci-dessous.

### Modifié
- **Consolidation de l'ajout d'invité sur `/checkin/[invitationId]`** (retour de Gersom sur la fiche de Lys Landu : « il y a du doublon et puis des trucs qui ne marchent pas... quand on ajoute la personne qui est avec Lys, ça veut dire que par définition on approuve la personne et il faut la placer sur une table... [+Non prévu et Ajouter un invité] sont déjà pris en compte avec le plus »). Trois affordances faisaient à peu près la même chose avec un comportement différent ; il n'en reste plus que deux, cohérents :
  - Le **"+" de `GuestArrivalPanel`** (« Qui est arrivé ? ») appelle désormais `add_unplanned_arrival` (comme le faisait l'ancien bouton autonome « + Non prévu », retiré) au lieu de `add_invitation_member` : la personne ajoutée est nommée **et marquée arrivée immédiatement**, ce qui déclenche l'assignation de table de réserve en cas de dépassement — au lieu d'être simplement ajoutée à la liste prévue sans jamais apparaître comme arrivée. Nouvelle capacité dédiée `canAdd` (= `submitGuestApproval`), distincte de `canManage` (= `manageMembers`, toujours réservée au renommage) : `agent_checkin` garde la capacité de renommer mais ne voit plus ce bouton — même règle que `/api/members/add-unplanned` depuis la v1.35.0.
  - Le bouton autonome **« + Non prévu »** (mini-formulaire propre à la page checkin) a disparu, remplacé par le "+" ci-dessus.
  - Le lien **« Gérer les membres du groupe »** a disparu de la fiche de check-in (« elle ne sert plus à rien parce qu'on peut faire ça directement dans la page ») — la route `/checkin/[invitationId]/members` reste fonctionnelle (accès direct par URL) pour la liste pré-événement et le retrait définitif d'une ligne, simplement plus reliée depuis ce parcours.
  - **« 📷 Invité surprise » reste inchangé** — toujours utile quand une approbation visuelle stricte est voulue (« si on veut vraiment que la personne ... doit impérativement se faire approuver par photo »).

### Tests
- `tests/guest-arrival-panel.test.ts` : assertions mises à jour pour le "+" de `GuestArrivalPanel` (`add-unplanned`, `canAdd`, `onAfterAdd`) au lieu de `add`/`canManage` ; suppression des tests sur l'ancien "+ Non prévu" et « Gérer les membres du groupe » de la page checkin.
- `tests/guest-approval-linked-invitation.test.ts` : titre de test ajusté (retrait de la référence à l'ancien "+ Non prévu" côte à côte).
- `tests/navigation-resilience.test.ts` : nouveau test vérifiant la réinitialisation d'état sur les quatre pages touchées par le flash de navigation.
- `npx tsc --noEmit`, `npm run build`, 197 tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

### Migrations
- Aucune.

Version: 1.39.1 → 1.39.2

## [1.39.1] — 2026-09-02

### Corrigé
- Les approbations et abonnements push sont maintenant rattachés à l'événement de la session, même lorsque plusieurs événements existent.
- Les lectures client des approbations demandent explicitement des données temps réel sans cache.
- L'activation des notifications gère Android et iOS installé (PWA), avec retour d'erreur visible.

### Tests
- `tests/guest-approvals.test.ts` : non-régression du rattachement événementiel, du cache et de l'activation push.

Version: 1.39.0 → 1.39.1

## [1.39.0] — 2026-09-02

### Ajouté
- La création d'une activité dans `/agenda` reprend le formulaire visuel de la maquette et permet de choisir immédiatement les responsables de l'équipe, un invité recherché ou un nom libre avant « Ajouter et partager ».

### Tests
- `tests/agenda-form.test.ts` : non-régression de la sélection des responsables dès la création.

Version: 1.38.1 → 1.39.0

## [1.38.1] — 2026-09-02

### Corrigé
- Sur `/agenda`, les raccourcis latéraux `Agenda` et `Bord` sont inversés afin que le widget Agenda conserve sa position habituelle sur cette page, sans modifier la navigation de `/dashboard` ou `/scan`.

### Tests
- `tests/navigation-resilience.test.ts` : non-régression de l'ordre contextuel des raccourcis sur `/agenda`.

Version: 1.38.0 → 1.38.1

## [1.38.0] — 2026-09-02

### Corrigé
- Les réponses de l'API publique d'approbation d'invité portent désormais `Cache-Control: private, no-store` afin d'éviter la conservation de données personnelles et d'URL photo signée dans les caches.
- La route de check-in utilise la capacité centralisée `checkin` au lieu d'une liste locale de rôles.
- La réinitialisation des données de test passe par une fonction SQL transactionnelle, verrouille l'événement et refuse elle-même le mode LIVE. Les erreurs ne sont plus ignorées.

### Migrations
- `0047_atomic_reset_test_event_data.sql` — nouvelle fonction de réinitialisation atomique; à appliquer après validation, sans écriture automatique en production.

## [1.37.0] — 2026-09-02

Retour de Gersom sur `/agenda` (capture d'écran de la fiche de modification à l'appui) : « au lieu d'avoir toute la liste des responsables à défiler... un champ... quand je clique dessus ça me demande de choisir la personne ».

### Ajouté
- **Sélecteur de responsables en recherche plein écran** (`components/ResponsablePicker.tsx`), à la place de la longue liste de cases à cocher toujours dépliée dans la fiche de modification d'une activité. Le champ Responsables devient un simple bouton résumant la sélection (« Choisir les responsables » si vide) ; le toucher ouvre une fiche avec un champ de recherche.
  - **Équipe** (comptes de l'application) affichée par défaut, filtrée en tapant.
  - **Invités** : « au cas où on assigne un invité lambda dernière minute pour aider » — à partir de 2 caractères, recherche aussi parmi les invitations (`ilike` sur `nom_affichage`, 20 résultats max) pour retrouver quelqu'un du cortège aidant ponctuellement, sans avoir à charger toute la liste des ~400 invités d'un coup. Sélectionner un invité l'ajoute comme nom libre (`custom_assignees`), exactement comme le mécanisme déjà existant pour un prestataire externe.
  - Le champ « nom personnalisé » (pour quelqu'un d'entièrement absent des deux listes) reste disponible en bas de la fiche.
  - Mêmes deux champs qu'avant (`assignee_ids`, `custom_assignees`) — seule la manière de les remplir change, aucune migration nécessaire.

### Tests
- `tests/agenda-form.test.ts` : assertions déplacées vers `components/ResponsablePicker.tsx` (coche personnalisée, nom libre) ; nouveau test pour la recherche parmi les invités.
- `npx tsc --noEmit`, `npm run build`, 195 tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

### Migrations
- Aucune.

## [1.36.0] — 2026-09-02

Retour de Gersom sur le design de « + Invité » (capture d'écran de `/plan-table`) et sur `/admin/users` (capture d'écran de « Comptes de l'équipe »).

### Ajouté
- **`+ Invité` en bouton rond en verre**, à la place de l'ancien simple lien texte — « plus un bouton que juste du texte ». Extrait dans un composant partagé (`AddInvitationButton`, réutilise `.glass-icon-button`, même recette que la flèche Retour de `TopBar`) réservé à `addInvitation` (admin/directeur uniquement, jamais placeur/agent_checkin/visibilite — confirmé : « assure que cette fonction est active seulement... pour directeur de festin et admin afin qu'il puisse vraiment ajouter quelqu'un très rapidement... sans passer par le système d'approbation »).
- **Le même bouton apparaît désormais aussi sur `/dashboard`**, au même endroit (coin supérieur droit, à côté du menu du compte).
- **`/admin/users` : bascule Actif/Désactivé en verre liquide** (`.glass-toggle`, thème iOS) à la place de l'ancien badge texte cliquable.
- **`/admin/users` : possibilité de changer le rôle/accès d'un compte** directement depuis la fiche d'édition (même liste que la création). Comme le mode de connexion dépend du rôle (email + mot de passe pour admin, nom + PIN sinon), un changement de rôle exige le nouvel identifiant dans la même requête et efface le mode devenu obsolète — jamais un compte basculé sans moyen de se reconnecter.

### Modifié
- La flèche Retour de `TopBar` (présente sur presque tous les écrans) reprend elle aussi le thème « verre liquide » (`.glass-icon-button` : flou + saturation + reflet + `var(--elev-2)`), au lieu de `shadow-card` (`var(--elev-1)`, `none` en Maison) — cohérent avec le reste de la campagne verre liquide (v1.34.0).

### Tests
- `tests/add-invitation.test.ts` : assertions mises à jour pour le composant partagé `AddInvitationButton` (au lieu d'un lien texte dupliqué par page), présence sur `/dashboard`.
- `tests/admin-users.test.ts` (nouveau) : bascule `glass-toggle`, sélecteur de rôle dans la fiche d'édition, `role` envoyé seulement s'il a changé, validation stricte côté API (`/api/admin/users` PATCH) des identifiants requis lors d'un changement de rôle.
- `npx tsc --noEmit`, `npm run build`, 194 tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

### Migrations
- Aucune. `users.role` accepte déjà les cinq rôles (`0015_roles_v2.sql`), aucun changement de schéma nécessaire.

## [1.35.0] — 2026-09-02

Discussion avec Gersom sur l'idée d'un invité surprise "sous-invité" arrivant avec un groupe déjà invité, en continuité directe de la limite signalée en v1.34.0 (« l'app ne capture aucun lien entre une demande et une invitation existante »). Confirmé : parcours rapide et parcours photo coexistent (Option 2), tous deux réservés aux mêmes rôles que `/scan`.

### Ajouté
- **Invité surprise lié à un groupe déjà invité** (`0046_guest_approval_linked_invitation.sql`, colonne `linked_invitation_id`) : depuis `/checkin/[invitationId]`, un placeur/directeur/admin peut démarrer une demande d'approbation pour une personne arrivée avec le groupe affiché sur la fiche courante — côté préempli automatiquement (déjà connu, celui de l'invitation), photo prise avec l'appareil natif (`<input type="file" capture="environment">`, pas de flux caméra live nécessaire sur cette page), nom saisi, puis le même circuit d'approbation que depuis `/scan`. `auto_assign_table_for_guest_approval` (v1.34.0) gagne une **priorité 0** : si la demande est liée et que la table du groupe a de la place, la personne y est placée en premier — avant même la table excédentaire.
- Le nouveau bouton « 📷 Invité surprise » cohabite avec le bouton rapide existant « + Non prévu » (ex-« + Invité supplémentaire (non prévu) », libellé raccourci pour partager la ligne) sur `/checkin/[invitationId]`, tous deux réservés à `submitGuestApproval`.

### Modifié
- **`+ Non prévu` (ajout instantané d'un invité non prévu) exige désormais `submitGuestApproval` au lieu de `checkin`** : « si les scanners scannent, vous dites vous êtes quatre mais dans l'invitation il y a deux, ils ne vont même pas traiter votre demande... c'est les placeurs qui vont gérer le reste, car ils auront les bons accès » (demande explicite de Gersom). `agent_checkin`/`visibilite` voient désormais un message (« Une personne en plus ? Un placeur ou directeur peut l'ajouter. ») au lieu du bouton — le check-in normal des invités déjà prévus (`set-arrival-status`) n'est pas affecté, reste sur `checkin` pour tous.

### Tests
- `tests/guest-approval-linked-invitation.test.ts` (nouveau) : capacité resserrée sur `add-unplanned`, `set-arrival-status` inchangée, priorité 0 (groupe lié) avant priorité 1 (réserve) dans `auto_assign_table_for_guest_approval`, validation `invitation_id`/même événement côté API, `GuestApprovalCaptureFlow` sautant l'étape côté quand préempli, gating des deux boutons sur `/checkin/[invitationId]`.
- `tests/guest-arrival-panel.test.ts` : assertion mise à jour pour le libellé raccourci « + Non prévu ».
- `npx tsc --noEmit`, `npm run build`, 190 tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

### Migrations
- `0046_guest_approval_linked_invitation.sql` — écrite, testée, **appliquée en production le 02/09/2026** (vérifiée : `linked_invitation_id` existe, `auto_assign_table_for_guest_approval` toujours `SECURITY INVOKER`).

## [1.34.0] — 2026-09-02

Retour de Gersom sur le fonctionnement d'`/approbations` en test réel (capture d'écran à l'appui d'une décision qui a échoué) et sur le design de l'application (« je veux que tout soit vraiment bien flottant... que ça l'air d'une application faite par Apple », en référence explicite au thème « Liquid Glass », avec captures d'écran d'Apple Musique et de l'Horloge en modèles).

### Ajouté
- **Placement automatique à l'approbation** (`0045_auto_assign_table_for_guest_approval.sql`, fonction `auto_assign_table_for_guest_approval`) : « je n'ai pas besoin de voir réserver une table directement quand je vais sur la page approbation... être capable de approuver ou refuser rapidement ». Approuver une demande n'exige plus de choisir une table au préalable — la personne est placée automatiquement, dans l'ordre demandé : (1) la table excédentaire (réserve/Table 41) si elle a de la place, quel que soit le côté ; (2) sinon la table avec le plus de place libre du même côté que l'invité (côté déduit des invitations déjà assises à cette table) ; (3) sinon la table avec le plus de place libre de l'autre côté ; (4) si aucune table n'a de place nulle part, la demande reste approuvée sans table — jamais de double booking silencieux, un placeur ou directeur reprend la main manuellement comme avant. Le directeur de festin reste libre de déplacer la personne ensuite vers une autre table via les outils de déplacement existants. Le mécanisme de réservation avant approbation (v1.33.0, migration `0044`) reste fonctionnel sous le capot mais n'est plus le parcours principal.
- **Approuver/Refuser directement sur la carte de la liste** `/approbations`, sans ouvrir la fiche détaillée — jusqu'ici ces boutons n'existaient que dans la fiche.
- **Thème « verre liquide » (iOS Liquid Glass) appliqué aux surfaces partagées de toute l'application** : `.card`, `.action-row`/`.action-row-muted` et `.btn-secondary` (utilisés sur presque tous les écrans) reprennent désormais le même flou + saturation + reflet intérieur + ombre flottante que la barre de navigation du bas, dans les deux thèmes (Atrium clair et Maison sombre) — auparavant `.card` utilisait `shadow-card` (`var(--elev-1)`, littéralement `none` en Maison : aucune ombre) et un flou réservé au thème sombre uniquement, ce qui donnait des cartes plates (« juste une ligne et un chiffre dans une forme »). Les boutons Approuver/Refuser passent en verre teinté (couleur en filtre translucide façon Centre de contrôle iOS, `color-mix()`) plutôt qu'en aplat plein.

### Corrigé
- Le message de succès après approbation reflète désormais le vrai comportement (placement automatique) au lieu de mentionner une réservation qui n'existe plus dans ce parcours.

### Tests
- `tests/guest-approval-reservation.test.ts` : nouvelles régressions pour `auto_assign_table_for_guest_approval` (priorité réserve → même côté → autre côté → aucune table, jamais d'exception), l'appel depuis `lib/guestApprovalDecide.ts`, l'absence du lien « Réserver une table » sur `/approbations`, et le thème verre liquide appliqué dans les deux thèmes.
- `tests/guest-approvals.test.ts` : assertions mises à jour pour le nouveau message de succès et l'absence du lien de réservation manuelle en fiche détaillée.
- `npx tsc --noEmit`, `npm run build`, 183 tests (`node --test tests/*.test.ts`) — tous exécutés avec succès.

### Migrations
- `0045_auto_assign_table_for_guest_approval.sql` — écrite, testée, **appliquée en production le 02/09/2026** (vérifiée : `auto_assign_table_for_guest_approval` existe, `SECURITY INVOKER`).

## [1.33.1] — 2026-09-02

Retour de Gersom en test réel sur le compte de Rémy (directeur, 3 captures d'écran à l'appui), trois bugs distincts : un plantage sur `/agenda`, un badge d'approbations « comme hard codé », et le bas de `/dashboard` toujours trop chargé pour tenir sans défiler.

### Corrigé
- **`/agenda` plantait à l'ouverture (écran « Mise à jour de l'application », déconnexion forcée) tant que la migration `0043_agenda_custom_assignees.sql` n'est pas appliquée en production.** `select('*')` ne renvoie tout simplement pas la colonne `custom_assignees` si elle n'existe pas encore côté base — Postgrest ignore une colonne inexistante au lieu d'échouer — et le rendu faisait `...item.custom_assignees` (spread) sans vérification : `undefined` n'est pas itérable, ce qui plantait la page entière au premier item et déclenchait le filet de secours générique de `app/error.tsx`, qui déconnecte et renvoie vers `/login` quel que soit le type d'erreur réel — d'où l'impression de déconnexions fréquentes après « quelques manipulations ». `app/api/agenda/route.ts` normalise désormais ce champ en tableau (GET/POST/PATCH), et `app/agenda/page.tsx` ajoute un filet côté client (`|| []`) partout où ce champ est lu ou modifié, pour ne plus jamais planter même sur des données déjà en mémoire.
- **Le badge de demandes en attente restait figé (ex. « 2 ») alors que `/approbations` affichait « Aucune demande d'invité surprise pour l'instant ».** Les trois emplacements du badge (`AccountMenu` — avatar et menu déroulant —, `BottomNav`, `GuestApprovalsShortcut`) sondent tous `GET /api/guest-approvals?count=pending`, mais cette réponse n'excluait pas explicitement le cache HTTP (contrairement à la liste complète, qui portait déjà `Cache-Control: private, no-store`) : Safari/PWA pouvait réutiliser une ancienne réponse pour cette même URL sondée en boucle au lieu de repasser par le réseau, figeant le compte sur une valeur périmée qui semblait « hard codée ». Le serveur renvoie désormais le même en-tête `no-store` sur cette réponse, et les trois appelants passent explicitement `{ cache: 'no-store' }` — le compte reflète maintenant le vrai total en temps réel.
- **`/dashboard` restait trop chargé pour tenir sur un écran d'iPhone sans défiler** (« trop d'informations, il faut scroll down (...) pour que tout rentre dans la page »). Le `pb-10` de la version précédente ne visait que la dernière carte (Table 41) coupée, pas la hauteur totale de l'empilement. Resserré dans son ensemble : espacements entre sections (`space-y-6` → `space-y-4`), grilles de statistiques (`gap-3` → `gap-2`, valeurs `text-4xl` → `text-3xl`), cartes Staff/réserve (`py-3` → `py-2.5`) — tout le contenu, jusqu'à la dernière table de réserve, tient désormais sans défiler sur les appareils visés.

### Tests
- `tests/guest-approvals.test.ts` : nouvelle régression vérifiant l'en-tête `Cache-Control: private, no-store` sur `GET ?count=pending` et `{ cache: 'no-store' }` dans les trois appelants (`AccountMenu`, `BottomNav`, `GuestApprovalsShortcut`).
- `tests/agenda-form.test.ts` : régression pour la normalisation serveur (`normalizeAgendaItem`) et les filets côté client (`|| []`) sur `custom_assignees`.
- `tests/guest-approval-reservation.test.ts` : assertion du tableau de bord mise à jour pour le nouvel espacement resserré.
- `npx tsc --noEmit`, `npm run build`, 18 suites de tests (`node --test tests/*.test.ts`, 180 tests) — tous exécutés avec succès.

### Migrations
- Aucune nouvelle migration écrite dans cette version. `0043_agenda_custom_assignees.sql` et `0044_guest_approval_pre_approval_reservation.sql` (écrites en v1.33.0) ont été **appliquées en production le 02/09/2026** (colonnes `custom_assignees`/`reserved_table_id` et fonctions `reserve_table_for_guest_approval`/`release_guest_approval_reservation` vérifiées présentes après coup). Le correctif `/agenda` de cette version reste utile indépendamment : il rend l'application tolérante à une colonne manquante si une future migration additive tardait à être appliquée.

## [1.33.0] — 2026-09-02

Retour détaillé de Gersom en test réel (captures d'écran de `/dashboard`, `/agenda`, `/scan` et `/approbations` à l'appui), demandant explicitement que « le système d'appro soit fluide et fonctionne de bout en bout dans l'app ».

### Ajouté
- **Réservation de table avant approbation** (`0044_guest_approval_pre_approval_reservation.sql`, nouvelles colonnes/RPC `reserve_table_for_guest_approval` et `release_guest_approval_reservation`) : « je veux pouvoir cliquer tout de suite, voir les tables disponibles, la mettre sur une table (...) pour ne pas qu'on fasse du double booking ». Un placeur/directeur/admin/visibilite peut désormais réserver une table pour une demande encore `en_attente` — la place est aussitôt comptée dans la capacité (aucune autre demande en attente ne peut la prendre) sans créer d'invitation. À l'approbation, `lib/guestApprovalDecide.ts` finalise automatiquement la réservation en vraie assignation en réutilisant `assign_table_to_guest_approval_strict` (0038, aucune duplication de la logique de capacité) ; au refus, elle est simplement libérée. `/approbations/[id]/assign` gère désormais deux modes (réserver / assigner) selon le statut de la demande — pas de réorganisation d'invités déjà assis pour une demande pas encore décidée, seulement après approbation.
- **Agenda : responsable au nom libre** (`0043_agenda_custom_assignees.sql`, colonne `custom_assignees text[]`) : « permet d'ajouter un nom personnalisé... si c'est une tâche particulière » (ex. « Nourdine, électricien ») — un prestataire ou une tâche ponctuelle sans avoir à créer un compte, affiché avec les responsables habituels sur chaque carte.
- **`/scan` affiche la prochaine activité du chronogramme**, juste au-dessus du raccourci Approbations : « un bouton qui ramène à l'agenda, mais qui affiche directement c'est quoi la prochaine activité (...) rapidement la personne voit c'est quoi la prochaine étape ». Réservé à admin/directeur (capacité `viewAgenda`, même accès que l'onglet Agenda) ; s'appuie sur la case « terminé » de chaque activité plutôt que sur l'heure de l'appareil, pour rester correct même après minuit ou si le déroulement prend de l'avance/du retard. La hauteur de la caméra est resserrée (55dvh → 46dvh) pour que tout reste visible sans avoir à défiler.
- **Badge persistant sur l'avatar du compte** (`AccountMenu`) dès qu'une approbation est en attente, visible sur tous les écrans sans ouvrir le menu déroulant — auparavant le compteur n'existait que dans le menu.
- **`/scan` en paysage : caméra carrée à gauche, cartes en colonne à droite.** Retour de Gersom (capture d'écran à l'appui) : « quand on rotate l'iPhone... la portion caméra est plus petite... ça va mal », les trois cartes (prochaine activité, Approbations, Bord) empilées en pleine largeur écrasaient la caméra dans la faible hauteur du paysage. Choisi parmi les deux options proposées par Gersom : la caméra devient carrée (pleine hauteur) à gauche, les trois cartes forment une colonne étroite à sa droite, avec un titre réduit au minimum pour laisser toute la hauteur disponible — tout reste visible sans défiler. Le portrait n'est pas affecté.

### Corrigé
- **`/dashboard`** : la dernière carte (Table 41) restait légèrement coupée en bas d'écran sur iPhone, obligeant à un petit scroll. Espace de respiration augmenté en bas de la liste.
- **`/scan`** : le bouton « Prendre une photo » sous la caméra faisait doublon avec le gros bouton central déjà dédié à cette action — retiré.
- **Fiabilité des décisions Approuver/Refuser** : un double-appui rapide pouvait envoyer deux requêtes avant que le bouton ne se désactive (le state React `decidingId` n'était pas encore mis à jour), la seconde recevant à tort « Cette demande avait déjà été traitée » alors qu'elle semblait toujours en attente. Verrouillage synchrone (`useRef`) ajouté en plus du state. Le message « déjà traitée » reflète maintenant le **vrai statut actuel** renvoyé par le serveur (« maintenant Approuvée »/« maintenant Refusée ») au lieu d'un texte générique qui pouvait sembler contredire l'écran.
- La notification push envoyée aux placeurs à l'approbation porte désormais le vrai numéro de table quand une réservation vient d'être finalisée automatiquement (auparavant toujours « sans table » à ce stade, le numéro n'arrivait qu'à l'assignation manuelle ultérieure).

### Notifications push iPhone
- L'infrastructure était déjà complète (table `push_subscriptions`, `notifyGuestApprovalReviewers`/`notifyGuestApprovalPlaceurs`, bouton d'activation) — il manquait uniquement les variables d'environnement `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` sur Vercel, d'où le statut « push iPhone à configurer » resté affiché. Aucun changement de code : une paire de clés VAPID a été générée et transmise à Gersom avec les instructions de configuration Vercel. La demande d'autorisation de notification reste — et restera toujours — déclenchée par un geste explicite de l'utilisateur (contrainte du navigateur/iOS, aucun moyen de la rendre automatique).

### Tests
- `tests/guest-approval-reservation.test.ts` (nouveau) : garantie anti double-booking du RPC de réservation (compte les autres réservations en attente sur la même table), finalisation automatique à l'approbation sans dupliquer la logique de capacité, libération au refus, deux modes de l'écran d'assignation, garde anti double-tap, message de décision reflétant le vrai statut, badge persistant, retrait du bouton photo redondant, espacement du tableau de bord.
- `tests/agenda-form.test.ts` : régression pour le responsable au nom libre ; assertions mises à jour pour le renommage `setEditing` → `openEditing` (réinitialise le brouillon de nom personnalisé à l'ouverture/fermeture).
- `tests/guest-approvals.test.ts` : assertions mises à jour pour le nouveau lien de réservation (au lieu du bouton désactivé), l'agent transmis à la décision applicative, et le numéro de table dynamique dans la notification placeurs.
- `npx tsc --noEmit`, `npm run build`, 17 suites de tests (`node --test`) — tous exécutés avec succès.

### Migrations
- `0043_agenda_custom_assignees.sql` — écrite, testée ; appliquée en production le 02/09/2026 (v1.33.1).
- `0044_guest_approval_pre_approval_reservation.sql` — écrite, testée ; appliquée en production le 02/09/2026 (v1.33.1).

## [1.32.1] — 2026-09-02

Retour de Gersom sur le design des pop-up de `/agenda` (captures d'écran à l'appui) : « Améliore le UX et le design surtout au niveau des champs à remplir (...) more iOS style (...) Heure met le roll comme iPhone pour choisir ».

### Corrigé
- **`className="input"` sur `/agenda` ne faisait rien** : la classe n'a jamais été définie (même défaut que `.eyebrow` avant lui, voir `app/globals.css`), donc chaque champ retombait sur le style par défaut du navigateur — bordure fine, fond calé sur `color-scheme`, et surtout le libellé texte collé directement contre le champ dans le même `<label>` (« Heure08:00 », « ActivitéDécorateurs au Festif Chan » sur la capture). `.input` est maintenant définie pour de bon (bordure claire, coins généreux, focus en accent — même habillage que `/tables/add`), et chaque libellé vit dans son propre `<label>` séparé au-dessus du champ.

### Ajouté
- **Heure : roue native iOS/Android** (`<input type="time">`) au lieu d'un champ texte libre — demande explicite : « met le roll comme iPhone pour choisir ». Une case « + Ajouter une heure de fin » révèle une seconde roue pour saisir une plage (ex. `18:30–19:00`, format déjà utilisé par le chronogramme seed) ; la valeur composée continue d'être stockée telle quelle dans `time_label` (texte libre côté API, aucun changement de schéma).
- **Bouton de fermeture rond en verre** sur les deux pop-up (nouvelle activité, modifier l'activité), même motif que la fiche détaillée de `/approbations`, à la place du simple lien texte « Fermer ».
- **Coche personnalisée** (rond en accent, coche blanche) pour la liste des responsables, à la place de la case à cocher par défaut du navigateur.

### Tests
- `tests/agenda-form.test.ts` (nouveau) : `.input` réellement définie, libellés séparés des champs, roue native avec plage optionnelle, bouton de fermeture en verre, coche personnalisée.
- `npx tsc --noEmit`, `npm run build`, 16 suites de tests (`node --test`) — tous exécutés avec succès.

### Documentation
- Rattrape un décalage de version préexistant sur `ASSIGNATION_TABLES.md`, `docs/DATA_CHANGE_INSTRUCTIONS.md` et `docs/QE_QA_PROCESS.md` : coincés à « 1.29.5 » depuis plusieurs releases (leur date affichée avançait à chaque bump alors que le numéro de version ne correspondait plus à aucune chaîne recherchée par le script de mise à jour) — les 10 documents versionnés affichent de nouveau tous la même version.

## [1.32.0] — 2026-09-02

Retour de Rémy en test sur son téléphone (rôle directeur) : trois problèmes de navigation sur `/scan` et `/dashboard`, plus une demande d'ajout d'invité enrichi pour admin/directeur.

### Corrigé
- **Bouton central de `/scan`** : pour admin/directeur, il redevenait « Tableau de bord » (icône jauge) au lieu de rester l'appareil photo — l'action la plus fréquente sur cet écran. Reste désormais toujours l'appareil photo, comme pour tous les autres rôles qui peuvent soumettre une approbation.
- **Barre basse de `/scan`** : Approbations (déjà un gros bouton dédié juste au-dessus de la jauge d'arrivées, voir `GuestApprovalsShortcut`, et toujours dans le menu du compte) cède sa place à Tableau de bord, qui n'était sinon accessible que via un aller-retour par `/dashboard` ou le bouton central. `/dashboard` garde Approbations dans sa propre barre, seul raccourci rapide disponible sur cet écran.
- **Retour depuis `/dashboard`** : ouvrait `/` (SplashScreen), qui redirige elle-même vers `/dashboard` pour le directeur (boucle visible, décrite par Rémy comme « la page passeport bleu ») et vers `/scan` pour l'admin après un flash inutile. Ouvre désormais directement `/scan` pour tout rôle qui peut scanner (admin, directeur) ; `TopBar` n'écrase plus cette cible en la reréécrivant vers `/dashboard` (son garde-fou général pour admin/visibilite ne s'applique plus quand on est déjà sur `/dashboard`).

### Ajouté
- **Capacité `addInvitation` ouverte au directeur de festin**, en plus de l'admin (même trajectoire que `manageTags` en v1.30.1) — corrige un bug préexistant : `/tables/add` affichait déjà le formulaire à directeur/placeur via une liste de rôles codée en dur dans la page, mais l'API exigeait `addInvitation`, réservée à l'admin seul — la création échouait donc toujours en 401 pour ces rôles. Jamais remarqué : cette page n'avait aucun lien entrant dans l'application avant ce correctif. `placeur` perd l'accès à ce formulaire (n'a jamais fonctionné pour ce rôle) ; garde tout le reste de ses capacités opérationnelles inchangées.
- **`/plan-table` propose un raccourci « + Invité »** (réservé à `addInvitation`) vers ce formulaire, désormais réellement atteignable dans l'interface.
- **Le formulaire capture aussi le téléphone** (indicatif du pays inclus, ex. `+33 6 12 34 56 78`) et **les étiquettes courantes** (réservées à `manageTags`, donc admin/directeur) — dont Staff, qui rend la personne visible de tout le monde sur l'écran Staff, exactement comme depuis la fiche d'une invitation existante. La sélection de table utilise désormais le même sélecteur avec places libres réelles que le reste de l'application (`TablePicker`), au lieu d'un simple champ numéro de table.
- `lib/tags.ts` (nouveau) : la liste d'étiquettes rapides (`ETIQUETTES_RAPIDES`), auparavant définie uniquement dans `/checkin/[invitationId]`, est maintenant partagée avec `/tables/add` — plus de liste dupliquée à tenir synchronisée.

### Sécurité
- L'API `/api/invitations/add` n'applique les étiquettes reçues que si l'appelant a la capacité `manageTags`, indépendamment de ce que montre l'interface — un rôle qui peut ajouter un invité ne peut pas forcément le reclassifier (CLAUDE.md : le contrôle serveur reste obligatoire même si un bouton est masqué côté client).

### Tests
- `tests/permissions.test.ts` : matrice `addInvitation` séparée de `mergeInvitations` (qui reste admin seul), nouvelle assertion admin/directeur=true, placeur/agent_checkin/visibilite=false.
- `tests/navigation-resilience.test.ts` : réécrit pour la nouvelle disposition contextuelle (bouton photo toujours actif sur `/scan`, Tableau de bord en raccourci latéral, retour direct vers `/scan` depuis `/dashboard`).
- `tests/add-invitation.test.ts` (nouveau) : capacité centralisée (pas de liste de rôles locale), champs téléphone/étiquettes, restriction serveur `manageTags`, raccourci `/plan-table`, source partagée `lib/tags.ts`.
- `npx tsc --noEmit`, `npm run build`, 15 suites de tests (`node --test`) — tous exécutés avec succès.

## [1.31.1] — 2026-09-01

### Modifié
- Nelly reçoit désormais le rôle complet `directeur`, exactement comme Rémy : même tableau de bord, agenda, scan, approbations, gestion opérationnelle, appels du staff et permissions associées.
- Migration `0042_promote_nelly_directeur.sql` : promotion idempotente du compte Nelly par ses deux noms connus. L'ancienne exception `agenda_manager` n'est plus utilisée par l'application; toutes ses autorisations repassent par la matrice centrale du rôle `directeur`.

### Tests
- Les contrôles de navigation et d'agenda revérifient les capacités standard `viewAgenda`/`manageAgenda`, sans exception nominative dans le code applicatif.

## [1.31.0] — 2026-09-01

### Ajouté
- Chaque activité de `/agenda` ouvre maintenant un formulaire complet permettant de modifier facilement l'heure, le titre, le département, les détails/consignes et les responsables. Les changements sont enregistrés dans l'agenda partagé et apparaissent sur les autres appareils.
- Nelly conserve son rôle opérationnel `placeur`, mais reçoit une autorisation nominative `agenda_manager` afin de gérer l'agenda avec Gersom, les administrateurs et les directeurs de festin sans ouvrir ce droit à tous les placeurs.
- Migration `0041_agenda_manager_access.sql` : colonne privée `users.agenda_manager` et activation idempotente pour le compte de Nelly.

### Sécurité et tests
- Les routes GET/POST/PATCH de l'agenda vérifient côté serveur soit la capacité de rôle `viewAgenda`/`manageAgenda`, soit l'exception nominative en base. L'interface utilise la décision renvoyée par l'API, jamais le rôle seul.
- Régressions ajoutées pour les champs modifiables et l'autorisation nominative.

## [1.30.2] — 2026-09-01

### Corrigé
- La fiche détaillée d'une approbation possède maintenant un bouton X rond et explicite pour fermer le pop-up.
- Après approbation, le champ « Placement » devient directement cliquable pour les rôles autorisés à assigner une table. Avant la décision, il explique qu'il faut d'abord approuver au lieu d'aboutir à une erreur ambiguë.
- Le sélecteur rapide n'affiche que les tables pouvant accueillir tout le groupe avec de vraies places libres, indique le nombre disponible et place la table 41 en tête lorsqu'elle convient. Le statut et les notifications existantes continuent d'indiquer si la demande a été approuvée avec ou sans table.
- Une décision déjà traitée (concurrence entre deux approbateurs) actualise maintenant la fiche et affiche un message précis au lieu de mélanger ce cas avec une erreur réseau.

### Tests
- Régressions ajoutées pour le bouton X, le placement actionnable, le filtrage par capacité réelle et la priorité de la table 41.

## [1.30.1] — 2026-09-01

### Corrigé
- `/checkin/[invitationId]` répare automatiquement les anciennes invitations dont `nombre_prevu`/`nombre_arrive` existe sans liste nominative complète. Les lignes manquantes réapparaissent sans changer les totaux, avec le nom principal puis « Accompagnant à nommer », et les boutons individuels ✓/X remplacent de nouveau l’ancien compteur agrégé.
- La fiche rappelle désormais visiblement « Invitation approuvée », le statut de placement Confirmée/Provisoire et le nombre arrivé.
- L’ajout d’un accompagnant non prévu exige désormais son nom, hérite de l’invitation et passe directement au placement de l’excédent (priorité réserve/table 41), sans nouvelle demande d’approbation.
- La gestion des étiquettes est ouverte au `directeur` en plus de l’admin. Placeurs et agents scan voient les étiquettes mais ne peuvent ni en ajouter ni en retirer.

### Base de données
- Migration `0040_repair_missing_invitation_members.sql` : fonction idempotente `ensure_invitation_member_rows`, sans modification des compteurs agrégés.

### Tests
- Régressions ajoutées pour la réparation nominative, l’exigence du nom et la nouvelle matrice `manageTags`.

## [1.30.0] — 2026-09-01

### Ajouté
- `/agenda` devient un chronogramme partagé : les administrateurs et directeurs de festin peuvent ajouter une activité exactement entre deux étapes, affecter plusieurs comptes actifs, marquer une tâche terminée et voir les changements propagés aux autres appareils.
- Migration `0039_shared_agenda.sql` : table privée `agenda_items`, chronogramme initial, responsables, ordre, état terminé et traçabilité. RLS activée sans policy client; toutes les lectures/écritures passent par `/api/agenda` et la session signée.

### Corrigé
- Navigation admin/directeur contextuelle : sur `/dashboard`, Scan est l’unique gros bouton central et l’ordre est Recherche / Plan / Scan / Agenda / Approbations. Sur `/scan`, Tableau de bord devient l’unique gros bouton central et l’ordre est Recherche / Plan / Bord / Agenda / Approbations. La prise de photo reste disponible directement sous la caméra, sans second raccourci Scan dans la barre.

### Tests
- Régressions navigation, permissions `manageAgenda`, API protégée et migration RLS ajoutées. TypeScript, suites Node et build vérifiés.

## [1.29.5] — 2026-09-01

### Corrigé
- En orientation paysage sur iPhone et iPad, le conteneur racine restait limité à `max-w-md` (environ 448 px). La navigation passait bien en bande verticale à droite, mais au bord de cette colonne étroite, laissant de larges bandes latérales inutilisées. Le shell occupe désormais toute la largeur en paysage tout en conservant la colonne mobile centrée en portrait ; la navigation reste fixée à droite avec ses grandes cibles tactiles.
- Sur `/dashboard`, la flèche Retour des comptes `admin` et `directeur` ouvre désormais explicitement l'accueil `/`. L'exception évite que la règle générale « admin retourne au dashboard » ne transforme ce bouton en boucle vers la page déjà affichée.
- Lors d'une sélection multiple sur une table, le dock « Transférer / Échanger » remonte au-dessus du bord inférieur et adopte un verre translucide inspiré d'iOS (flou, reflet intérieur, coins généreux), avec deux boutons mieux détachés dans les thèmes clair et sombre.
- La fiche détaillée d'une approbation remonte maintenant près du haut de l'écran. Ses flèches précédente/suivante deviennent de grandes commandes flottantes en verre iOS avec de vraies icônes, et son ancien bloc de texte est remplacé par des champs lisibles « Nom / Invités / Côté / Demandé par / Placement ». Après décision, le statut distingue explicitement « Approuvé — sans table » et « Approuvé — Table X ».
- Performance des approbations sans forfait supplémentaire : les URL privées Supabase des photos sont maintenant signées en une seule requête groupée (au lieu d'une requête par photo), réutilisées 50 minutes côté serveur et préchargées avec les six premières photos pendant les trois secondes du splash. Les nouvelles captures iPhone/iPad sont ramenées à 1280 px maximum et JPEG 80 % avant l'envoi, suffisamment nettes pour l'identification mais beaucoup plus légères. Le bucket reste privé et les URL expirent toujours après une heure.
- La fiche Approbation est maintenant centrée dans le viewport au lieu d'être ancrée vers le bas. Sa photo est légèrement moins haute afin de garder les informations et actions dans la même fenêtre défilable.
- Le directeur de festin conserve Tableau de bord comme grand bouton central par défaut, mais gagne désormais l'onglet Scan à la place de Staff. Sur `/scan`, le bouton central devient toujours l'appareil photo. La barre basse est remontée et reçoit un verre plus saturé, un reflet intérieur et une ombre plus nette.
- La barre basse suit plus fidèlement la nouvelle référence iOS fournie : capsule continue de 96 px, rayon de 36 px, marge basse plus généreuse, flou 34 px/saturation 185 %, ombre profonde et reflet intérieur. Chaque raccourci reçoit une tuile arrondie de 44 px, les icônes passent à 30 px et le bouton central à 84 px, tout en conservant les libellés opérationnels.
- Ajustement Liquid Glass demandé après validation de la forme : opacité de la plaque réduite à 58 % en clair et 56 % en sombre, flou porté à 34 px avec saturation 185 %, bord lumineux spécifique par thème et petites tuiles elles-mêmes translucides. Le contenu défilant reste perceptible derrière la plaque sans sacrifier le contraste des commandes.

### Tests
- `tests/navigation-resilience.test.ts` vérifie maintenant conjointement la navigation verticale à droite, la suppression explicite de la largeur maximale du shell en paysage et la navigation Scan/Bord du directeur. `tests/guest-approvals.test.ts` couvre la fenêtre centrée, les champs structurés, les flèches en verre, les deux libellés d'approbation avec/sans table, la signature groupée, le préchargement du splash et le redimensionnement des captures.

## [1.29.4] — 2026-09-01

### Modifié
- `/scan` affiche maintenant un grand bouton Approbations juste au-dessus de la jauge d'arrivées, avec le nombre de demandes en attente. Approbations reste également dans le menu du compte en haut à droite, mais disparaît de toutes les barres de navigation basses afin de conserver Scan et Tableau de bord accessibles.
- Les comptes `admin` et `visibilite` reviennent au tableau de bord avec la flèche Retour des pages opérationnelles.
- `/approbations` ouvre directement la demande ciblée par une notification, affiche un résultat clair après Approuver/Refuser et permet de parcourir toutes les demandes avec les flèches précédente/suivante sans fermer la fenêtre.
- Après approbation, l'utilisateur choisit de voir les recommandations de tables ou de laisser le placeur assigner. Les recommandations priorisent les places réellement disponibles, montrent les places provisoires non arrivées et incluent la table de réserve. La fonction SQL stricte v1.29.1 reste l'autorité finale pour interdire tout dépassement ou déplacement d'une personne arrivée.
- Sans clés VAPID, une nouvelle demande déclenche désormais une alerte visible et un badge actualisé toutes les 5 secondes dans l'application. Le véritable Push iPhone hors application reste disponible dès que les trois variables VAPID sont configurées dans Vercel. Les placeurs peuvent maintenant s'abonner au Push avec leur droit de lecture des demandes, sans recevoir pour autant le droit Approuver/Refuser.

### Base de données
- Aucune nouvelle migration. Les migrations `0037_guest_approval_app_push.sql` et `0038_strict_guest_approval_assignment.sql` restent suffisantes.

### Tests
- Régressions navigation/approbations complétées pour le raccourci scanner, l'absence d'Approbations dans la barre basse, le retour Dashboard, la navigation entre demandes, les messages de succès, les recommandations et le fallback d'alertes dans l'application.

## [1.29.3] — 2026-09-01

### Corrigé
- `/scan` : la caméra était encore forcée au ratio horizontal `3/2`, soit environ 360 px de haut sur la capture d'un grand iPhone, avec une large moitié d'écran vide. Sa hauteur suit désormais le viewport avec `clamp(340px, 55dvh, 680px)` : compacte sur iPhone SE, nettement plus grande sur iPhone/Android modernes et plafonnée sur iPad/ordinateur.
- Le `<video>` remplit ce conteneur avec `object-cover` et le cadre QR est calculé proportionnellement à la largeur/hauteur réellement disponibles au lieu d'être figé à 260 px.

### Tests
- Régression ajoutée contre le retour du ratio `aspect-[3/2]`, avec garde-fous sur la hauteur responsive, le recadrage vidéo et le cadre QR dynamique.

## [1.29.2] — 2026-08-31

### Modifié
- Navigation admin : hors `/dashboard`, Approbations quitte la barre du bas et reste dans le menu du compte en haut à droite, avec le badge des demandes en attente. La place libérée conserve un accès direct à Scan.
- Sur `/dashboard` uniquement, la barre suit l'ordre demandé : Recherche, Plan, Scan au centre, Agenda, Approbations. Le badge reste visible à la fois sur cette pastille et dans le menu du compte.

### Tests
- Régression ajoutée pour la variante contextuelle du tableau de bord, le Scan central, l'absence d'Approbations dans la barre admin générale et le badge du menu du compte.

## [1.29.1] — 2026-08-31

### Corrigé
- `/approbations` : toute la carte d'une demande est maintenant ouvrable au toucher ou au clavier. La vue détaillée affiche la photo en grand, le côté Nelly/Gégé, le statut, le nombre de personnes, le demandeur et les actions Approuver/Refuser.
- Après approbation dans l'application, les approbateurs authentifiés (`admin`, `directeur`, `visibilite`) peuvent choisir la table depuis cette vue. Le `placeur` conserve son droit d'assignation opérationnelle.
- La vue propose explicitement « Choisir la table moi-même » ou « Laisser le placeur l'assigner ». Dans ce second cas, la demande reste approuvée et sans table dans la liste, sans écriture supplémentaire ni assignation automatique.
- Une réponse SMS/WhatsApp reste strictement limitée à Oui/Non : aucun message entrant ni lien public ne peut choisir une table. L'assignation demeure une route séparée, authentifiée et protégée par `assignGuestApproval`.
- Pour un admin, tous les boutons Retour historiquement dirigés vers `/scan` reviennent désormais au `/dashboard`.
- Après une approbation, tous les placeurs abonnés reçoivent une notification opérationnelle. Sans table, elle ouvre directement le parcours d'assignation; après placement, une seconde notification confirme la table.
- Migration `0038_strict_guest_approval_assignment.sql` : l'assignation et les déplacements nécessaires sont une seule transaction. La base refuse une table ou destination surchargée, un doublon de déplacement et tout déplacement d'une invitation déjà arrivée. L'écran affiche Confirmée/Provisoire et Arrivée/Non arrivée, exige de libérer autant de places que nécessaire et bloque la confirmation tant que la destination n'a pas assez de capacité.

### Tests
- Garde-fous ajoutés pour la vue détaillée, la photo agrandie, les actions, la matrice d'assignation, l'absence totale de choix de table dans les canaux texto/WhatsApp, les notifications placeurs, le retour admin et les contrôles atomiques de capacité.

## [1.29.0] — 2026-08-31

### Ajouté
- `/agenda` : premier chronogramme mobile du jour J, accessible uniquement à `admin` et `directeur`. Il reprend les grandes étapes du document Canva fourni et affiche explicitement « Responsable à attribuer » tant que les agents, départements et shifts définitifs n'ont pas été transmis. Aucun état « fait » ni affectation n'est inventé ou écrit en base dans cette première phase.
- Navigation : pour le directeur, le raccourci `Staff` du bas devient `Agenda` (la fiche Staff reste accessible depuis le tableau de bord et depuis l'Agenda). Pour l'admin, `Scan` redevient un raccourci permanent de la barre du bas ; le tableau de bord reste accessible en touchant la jauge d'arrivées sur `/scan`.

### Modifié
- `/scan` : le bouton central déclenche maintenant la capture live pour `admin`, `placeur` et `directeur`, même si le raccourci central habituel du directeur est `Bord`. `agent_checkin` reste exclu conformément à la règle de sécurité des invités surprise.
- La jauge d'arrivées et la navigation basse sont plus hautes, avec des icônes et cibles tactiles agrandies pour iPhone, Android, iPad et appareils dont le bas de l'écran est difficile à utiliser.

### Tests
- Matrice de rôles `/agenda`, navigation admin/directeur, capture contextuelle sur `/scan`, chronogramme sans affectations inventées, hauteurs tactiles et responsive paysage ajoutés aux suites existantes.

## [1.28.0] — 2026-08-31

### Ajouté
- `/scan` : pour `admin` et `placeur`, le bouton central devient un déclencheur photo. Il capture directement une frame JPEG du flux vidéo déjà ouvert par le scanner QR (`video` → `canvas`), sans lancer l'application Caméra d'iOS/Android. L'ancien bouton « Invité surprise (non prévu) » est supprimé ; après la photo, le placeur choisit Côté Nelly/Gégé, saisit le nom et le nombre, puis envoie la demande.
- `/approbations` : les demandes en attente peuvent être approuvées ou refusées directement dans l'application par `admin`, `directeur` et `visibilite`. Un badge numérique apparaît dans la navigation des rôles approbateurs. `admin` et `placeur` gardent seuls l'assignation finale de table.
- Notifications Web Push PWA : activation volontaire depuis `/approbations`, notification d'une nouvelle demande et ouverture directe de la liste au toucher. Twilio SMS/WhatsApp reste un canal externe best-effort et la demande reste toujours visible dans l'application même si Twilio ou Push n'est pas configuré.
- Migration `0037_guest_approval_app_push.sql` : canal de décision `app` et table privée `push_subscriptions` (RLS activée, aucun accès anon/authenticated).

### Sécurité et rôles
- Capacités séparées : `submitGuestApproval` (`admin`, `placeur`), `reviewGuestApproval` (`admin`, `directeur`, `visibilite`), `assignGuestApproval` (`admin`, `placeur`) et `viewGuestApprovals` (tous ces rôles). `agent_checkin` n'a aucune de ces capacités.
- Toutes les routes de création, lecture, décision, assignation et abonnement Push vérifient la capacité précise côté serveur ; les clés VAPID privées et les abonnements ne quittent jamais le serveur.

### Tests
- `tests/guest-approvals.test.ts` couvre la matrice de rôles, la capture live sans `input capture`, la décision dans l'app, le badge et la confidentialité RLS des abonnements Push.
- `npx tsc --noEmit`, `npm run test:guestapprovals`, `npm run test:roles`, `npm run test:navigation` et `npm run build` vérifiés avant livraison.

## [1.27.2] — 2026-08-30

Advisory de sécurité Supabase signalé en tout début de ce chantier (avant même l'invité surprise), resté sans décision jusqu'à ce que Gersom explore le tableau de bord de sécurité aujourd'hui.

### Sécurité
- **`supabase/migrations/0036_enable_rls_user_credential_backups.sql`** (nouveau) : `public.user_credential_backups` avait RLS **désactivée** — table du schéma `public` entièrement exposée aux rôles `anon`/`authenticated` si elle porte les grants correspondants (contrairement à « RLS activée sans policy », qui refuse tout par défaut — ici rien ne refusait quoi que ce soit). Recherche complète dans le dépôt : cette table n'est référencée nulle part, ni créée ni utilisée par cette application. Correction : active RLS, sans ajouter de policy — même posture que toutes les autres tables sensibles du dépôt (`users`, `audit_logs`, `import_backups`, `invitations_backup_*`, `placement_status_backup_*` : RLS activée, zéro policy, accès réservé à `service_role`). Pas de policy basée sur `auth.uid()` : cette application n'utilise pas Supabase Auth (session PIN/cookie maison), `auth.uid()` y serait toujours nul.
- Passage en revue des nouveaux advisories `rls_enabled_no_policy` (niveau INFO) sur `audit_logs`, `festin_directors`, `guest_approval_requests`, `guest_approvers`, `import_backups`, `invitations_backup_*`, `placement_status_backup_20260828`, `users` : **aucune action nécessaire** — ce sont exactement les tables conçues pour être fermées par défaut (`festin_directors`/`guest_approvers`/`guest_approval_requests` volontairement sans policy anon depuis `0032_guest_approvals.sql`, les autres déjà documentées comme telles avant ce chantier). « RLS activée sans policy » est l'état sécurisé recherché pour ces tables, pas une alerte.
- Réconciliation du suivi de migrations pour l'intégration GitHub↔Supabase (Database → Migrations) : ce dépôt nomme ses fichiers `NNNN_nom.sql` (ex. `0032_guest_approvals.sql`), alors que le suivi de Supabase attend un format horodaté et compare par préfixe exact — sans correspondance, la prochaine synchronisation automatique aurait rejoué l'intégralité de l'historique des migrations contre une base déjà à jour (échec immédiat, « déjà existant »). Gersom a inséré manuellement une ligne de suivi par fichier actuellement dans `supabase/migrations/` (préfixe existant du fichier comme version), sans renommer aucun fichier ni toucher au contenu déjà appliqué — 33 lignes ajoutées, aucun conflit avec les entrées déjà suivies. « Déployer en production » (case à cocher côté Supabase) reste sûr à activer désormais.

### Tests
- Aucun changement de code applicatif — une seule instruction SQL (`enable row level security`), sans policy, sur une table inutilisée par l'application. `npx tsc --noEmit`, `npm run build`, 14 suites de tests (`node --test`, 125 tests) revérifiés sans régression.

### Migrations
- `0036_enable_rls_user_credential_backups.sql` — écrite, testée ; en attente d'application en production (même blocage d'approbation d'outil que sur les migrations précédentes — à appliquer via le SQL Editor Supabase, voir instructions ci-dessous).

## [1.27.1] — 2026-08-30

Complète le déploiement de v1.27.0 : les deux migrations laissées « écrites, testées, en attente d'application » (blocage d'approbation d'outil côté session) ont été appliquées en production par Gersom lui-même via le SQL Editor Supabase.

### Corrigé
- **Doublons dans `festin_directors`** : le script d'insertion de Rémy Landu et Tuzola (`0033_festin_directors_contacts.sql`) a été relancé plusieurs fois pendant que l'agent tentait de contourner le blocage — sans contrainte d'unicité sur `telephone`, `on conflict do nothing` n'avait aucun arbitre pour se déclencher (`festin_directors.id` est un uuid aléatoire, pas un identifiant naturel), ce qui a créé 3 copies de chaque directeur au lieu d'une. Dédoublonné manuellement (conservé la ligne la plus ancienne par téléphone) dans le même geste que l'application de la migration.
- **`supabase/migrations/0035_festin_directors_unique_phone.sql`** (nouveau, appliquée en production) : `alter table festin_directors add constraint festin_directors_telephone_key unique (telephone)` — documente dans le dépôt la contrainte appliquée manuellement, pour que le schéma versionné reste la source de vérité (`CLAUDE.md` : « toute modification manuelle de production doit être reflétée dans une migration GitHub ») ; empêche aussi qu'un futur re-jeu accidentel du même insert recrée des doublons.

### Performance
- Point de vérification demandé par Gersom avant l'événement (« quand 30 personnes se connectent, est-ce que ça reste stable ? ») : revue des abonnements temps réel (11 sur l'appli, tous avec un nettoyage `removeChannel` correctement apparié — aucune fuite), des colonnes sélectionnées (`ScanStatsStrip`, ajouté aujourd'hui sur `/scan` — l'écran que la majorité du staff garde ouvert toute la soirée — ne sélectionne que 2 colonnes étroites, pas `select('*')`) et du volume de données réel (247 invitations, 41 tables — trivial pour Postgres/PostgREST). Conclusion : rien à corriger pour tenir 30 connexions simultanées, les clients navigateur passent par PostgREST (HTTP), pas par des connexions Postgres directes.
- **`app/approbations/page.tsx`** : intervalle de sondage resserré de 5s à 15s — chaque sondage régénère une URL signée Storage par photo côté serveur (`GET /api/guest-approvals`), inutile de le faire toutes les 5s pour un écran secondaire (pas celui que tout le monde garde ouvert, contrairement à `/scan`).

### Migrations
- `0033_festin_directors_contacts.sql` — **appliquée en production** (dédoublonnée, voir ci-dessus).
- `0034_guest_approval_whatsapp.sql` — **appliquée en production**.
- `0035_festin_directors_unique_phone.sql` — **appliquée en production**.

### Tests
- `npx tsc --noEmit`, `npm run build`, 14 suites de tests (`node --test`, 125 tests) — tous exécutés avec succès après le resserrement de l'intervalle de sondage.

## [1.27.0] — 2026-08-30

Prompt de handoff complet de Gersom : invité surprise avec approbation par SMS à distance (Twilio), plus un complément vocal (décompte de places dans le SMS de confirmation, rapport au directeur de festin, confirmation que seuls admin/directeur/placeur y ont accès).

### Ajouté
- **Invité surprise depuis `/scan`** : bouton « 📷 Invité surprise (non prévu) », réservé à la nouvelle capacité `guestApproval` (admin/directeur/placeur — **jamais** agent scan ni visibilité : « si le scanner voit des personnes en plus, il ne fait rien, il va voir le placeur directement »). Parcours en 3 écrans : photo (`<input type="file" capture="environment">`, une seule prise) → côté (Nelly/Gégé) → nom + nombre d'invités → envoi.
- **`supabase/migrations/0032_guest_approvals.sql`** (appliquée en production) :
  - `guest_approvers` (cote → nom/téléphone de l'approbateur, config plutôt que variable d'environnement) — pré-rempli avec les deux numéros donnés par Gersom : **« Mon Papa » (Canada, +1 514 815 1586) = Côté Gégé**, **« Papa David » (France, +33 6 43 34 85 60) = Côté Nelly** (confirmé explicitement).
  - `festin_directors` (nom/téléphone des destinataires du SMS de rapport) — pré-remplie via **`0033_festin_directors_contacts.sql`** (appliquée en production) dès que Gersom a confirmé les numéros : **Rémy Landu (+33 6 51 87 47 79)** et **Tuzola (+33 6 69 01 68 03)**.
  - `guest_approval_requests` (photo, côté, nom, nombre, statut, décision, table assignée…), RLS activée mais **sans aucune policy anon** — contrairement aux tables opérationnelles historiques (0003_rls.sql) : le `token` doit rester confidentiel, une lecture anon même « pour le temps réel » l'exposerait à quiconque possède la clé anon.
  - Bucket Storage privé `guest-approval-photos` (jamais public — toujours résolu en URL signée côté serveur, 1h de validité, `lib/guestApprovalPhotos.ts`).
  - RPC `assign_table_to_guest_approval` : crée l'invitation à la table choisie pour une demande **déjà approuvée**, refuse sinon (409) ; jamais utilisée avant approbation.
- **`lib/twilio.ts`** : envoi de SMS via l'API REST Twilio directement en `fetch()` (pas de SDK ajouté en dépendance). **Jamais de MMS** — un numéro Twilio français ne le supporte pas ; seuls les numéros US/Canada le permettraient. Le SMS contient toujours un lien vers `/approve/[token]`, jamais la photo elle-même.
- **`lib/guestApprovalNotify.ts`** : trois SMS distincts, tous texte seul —
  1. à l'approbateur, à la création de la demande (lien `/approve/[token]`) ;
  2. à l'approbateur, après sa décision — « il vous reste maintenant N places » en réserve si approuvé (demande de Gersom), simple accusé de réception si refusé ;
  3. au directeur de festin (`festin_directors`), après assignation de table — qui a approuvé, combien de places, quelle table, combien de places de réserve restent. Le calcul des places de réserve réutilise `computeTableCapacities` (`lib/capacity.ts`), même logique que `/dashboard`/`/plan-table`.
- **`app/api/guest-approvals/route.ts`** (POST création + upload + SMS, GET liste pour `/approbations`) et **`app/api/guest-approvals/[id]/assign-table/route.ts`** (POST, finalise une demande approuvée) — capacité `guestApproval`, **volontairement pas** la capacité `addInvitation` (réservée à l'admin, voir `/api/invitations/add`) : action étroite qui ne peut agir que sur une demande déjà approuvée par SMS, jamais un droit général d'ajout d'invitation.
- **`app/api/public/guest-approvals/[token]/route.ts`** et **`.../decide/route.ts`** — routes **publiques** (préfixe `/api/public`, ajouté à `middleware.ts`), sans session : la connaissance du token est l'autorisation. La décision (`POST .../decide`) est atomique (`UPDATE ... WHERE statut = 'en_attente'`) : un deuxième clic sur un lien déjà tranché reçoit `409` avec le statut réel, jamais une double décision silencieuse ni une erreur brute.
- **`app/approve/[token]/page.tsx`** — page publique (ajoutée à `middleware.ts`), sans connexion, sans navigation : photo, nom, nombre, côté, boutons Approuver/Refuser.
- **`app/approbations/page.tsx`** (liste des demandes, sondage 5s — pas de websocket temps réel : `guest_approval_requests` n'a pas de policy anon, voir plus haut) et **`app/approbations/[id]/assign/page.tsx`** (assignation de table via `TablePicker`, même sélecteur que `/tables/move/[invitationId]`) — nouveau raccourci « 📷 Approbations » dans le menu du compte (`AccountMenu.tsx`), capacité `guestApproval`.
- **Canal WhatsApp en plus du SMS**, demande de Gersom : « donne l'option par WhatsApp ou message... au cas où il n'a pas de réseau [cellulaire] et est connecté au wifi » (WhatsApp passe par data/wifi, contrairement au SMS qui a besoin du réseau cellulaire).
  - **`supabase/migrations/0034_guest_approval_whatsapp.sql`** : colonne `decided_via` (`'web'` ou `'whatsapp'`) sur `guest_approval_requests` — traçabilité du canal utilisé pour décider.
  - `lib/twilio.ts` : `sendWhatsApp()` (Content Template Twilio + `ContentVariables`, jamais de texte libre pour un message initié par l'app — Meta l'exige hors fenêtre de session de 24h) et `validateTwilioSignature()` (HMAC-SHA1 officiel, *fail closed* sans `TWILIO_AUTH_TOKEN`/en-tête).
  - `lib/guestApprovalNotify.ts` : le SMS et le WhatsApp initiaux partent en parallèle (`Promise.allSettled`), chacun best-effort — l'échec de l'un (WhatsApp, tant que son Content Template n'est pas encore approuvé par Meta) ne bloque jamais l'autre (SMS, canal de référence).
  - **`app/api/public/twilio/whatsapp-inbound/route.ts`** (nouveau, public) : webhook Twilio ("A message comes in" sur le numéro WhatsApp) — l'approbateur répond directement **« Oui »/« O »/« Y »** ou **« Non »/« N »** au message WhatsApp, sans avoir besoin de cliquer le lien (celui-ci reste utile pour voir la photo). Authentifié par la signature Twilio, pas par session ni token dans l'URL (une réponse texte libre n'en porte pas) ; la demande concernée est retrouvée par numéro de téléphone (la plus récente encore `en_attente` pour ce numéro). Répond en TwiML pour confirmer la décision directement dans la conversation WhatsApp.
  - **`lib/guestApprovalDecide.ts`** (nouveau) : logique de décision atomique **partagée** entre `/approve/[token]` (lookup par token) et le webhook WhatsApp (lookup par téléphone) — `app/api/public/guest-approvals/[token]/decide/route.ts` a été refactorisé pour l'utiliser, plus de duplication.
  - Template WhatsApp proposé (Content Template Twilio, 4 variables — **pas encore créé/approuvé côté Twilio**, `TWILIO_WHATSAPP_CONTENT_SID_REQUEST` reste vide en attendant) :
    ```
    Mariage Nelly & Gersom
    {{1}} souhaite venir avec {{2}} invité(s) (côté {{3}}).
    Répondez OUI ou NON à ce message, ou voir la photo : {{4}}
    ```
    (1=nom_invite, 2=nombre_invites, 3=côté, 4=lien `/approve/[token]`)

### Tests
- `tests/guest-approvals.test.ts` (22 tests, +8) : capacité `guestApproval` correctement bornée, routes publiques sans session, clé de service jamais exposée côté client, décision atomique et partagée entre les deux canaux, aucun MMS tenté (SMS et WhatsApp), bucket privé, RLS sans policy anon, `assign_table_to_guest_approval` n'utilise pas `addInvitation`, mapping téléphone/côté des deux approbateurs et des deux destinataires du rapport, `validateTwilioSignature` fail-closed (signature valide vérifiée avec le même algorithme que Twilio), parsing Oui/Non insensible à la casse/aux accents.
- `tests/navigation-resilience.test.ts` : `/approbations` ajouté à la liste des écrans utilisant le patron responsive paysage (10e écran).
- `npx tsc --noEmit`, `npm run build`, 14 suites de tests (`node --test`, 125 tests) — tous exécutés avec succès.

### Migrations
- `0032_guest_approvals.sql` — appliquée en production (additive : nouvelles tables/bucket/RPC uniquement, aucune donnée existante modifiée). Les deux numéros de `guest_approvers` ont été fournis explicitement par Gersom pour cet usage précis.
- `0033_festin_directors_contacts.sql` — écrite et testée (additive : deux lignes de configuration, numéros de Rémy Landu et Tuzola fournis explicitement par Gersom pour cet usage précis) ; application en production en attente (blocage d'approbation d'outil côté session, à relancer).
- `0034_guest_approval_whatsapp.sql` — écrite et testée (additive : colonne `decided_via` sur `guest_approval_requests`) ; application en production également en attente, même blocage.

### ⚠️ Actions manuelles requises (Vercel + Twilio)
- **SMS** (obligatoire) : `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` dans Vercel → Settings → Environment Variables. Sans elles, une demande d'invité surprise reste créée normalement (photo + infos conservées), mais l'agent est averti explicitement que le SMS n'est pas parti.
- **WhatsApp** (optionnel, complément au SMS) : `TWILIO_WHATSAPP_NUMBER` (numéro expéditeur WhatsApp) et `TWILIO_WHATSAPP_CONTENT_SID_REQUEST` (le Content Template ci-dessus, une fois créé et approuvé côté console Twilio/Meta) ; configurer aussi le webhook entrant du numéro WhatsApp ("A message comes in") vers `https://mariage-checkin.vercel.app/api/public/twilio/whatsapp-inbound`. Sans ces variables, `sendWhatsApp()` ne fait rien silencieusement — le SMS continue de fonctionner seul.

## [1.26.0] — 2026-08-30

Retour vocal de Gersom sur l'usage réel de la barre de navigation, plus deux demandes ponctuelles.

### Changé
- **Barre de navigation redessinée en « verre liquide ».** « La barre qui est en bas, je ne la trouve pas assez accessible... c'est difficile à voir » — comparée explicitement au style de barre d'onglets iOS récent : plus grande, ronde, claire.
  - `components/BottomNav.tsx` : icônes agrandies (`h-5`→`h-6`), libellés inactifs passés de `text-text-faint` (42 % d'opacité, jugé illisible sur fond sombre) à `text-text-muted` (55 %). La barre devient une **pilule flottante** en verre dépoli (`rounded-3xl`, ombre, flou, légèrement surélevée du bord) au lieu d'une bande plate collée au bord de l'écran.
  - `app/globals.css` : nouvelle utilité `.safe-right` (`env(safe-area-inset-right)`), miroir de `.safe-bottom`/`.safe-top`, pour la variante paysage ci-dessous.
- **Bascule en bande verticale à droite quand le téléphone est tourné (ou sur iPad en paysage).** « Si je tourne le téléphone sur le côté, je veux que ça fasse vraiment comme une bascule... les boutons vont à la droite au lieu de rester en bas... figés à droite mais qu'on peut scroll de haut en bas... la même chose sur un iPad. »
  - `components/BottomNav.tsx` : variante Tailwind `landscape:` (media query `orientation: landscape` native, sans configuration) — la pilule horizontale devient une bande verticale pleine hauteur fixée au bord droit ; le bouton central se soulève vers le contenu (gauche) plutôt que vers le haut.
  - Patron d'écran (`flex h-dvh flex-col overflow-hidden` → `... landscape:flex-row`) appliqué aux 9 écrans qui utilisent `BottomNav` (`/dashboard`, `/staff`, `/scan`, `/search`, `/plan-table`, `/exceptions`, `/placement`, `/history`, `/admin`) : `TopBar` + contenu regroupés dans un conteneur colonne dédié pour que `BottomNav` devienne un vrai second enfant en ligne (`flex-row`) plutôt qu'un troisième élément écrasé. Le contenu garde son propre défilement vertical (`overflow-y-auto`), indépendant de la barre.

### Ajouté
- **`components/ScanStatsStrip.tsx`** (nouveau) : bande compacte entre l'écran de scan et la barre de navigation — « en dessous de l'écran scan, les boutons du bas vont être un peu plus haut, il va rester un petit espace avec de l'information de base du tableau de bord, par exemple le nombre d'invités, le nombre arrivés, la progression du remplissage de la salle. » Reprend les mêmes agrégats que `/dashboard` (`nombre_prevu`/`nombre_arrive`, capacité des tables), version résumée d'une ligne + jauge compacte (`CapacityGauge` `size="sm"`), abonnée au temps réel ; ouvre `/dashboard` au tap.
- Câblée dans `app/scan/page.tsx`, entre le scanner QR et `BottomNav`.

### Sécurité / permissions
- **`/history` réservé à l'admin.** « Ce n'est pas toutes les rôles qui ont accès à l'historique, donne l'accès seulement aux admins. »
  - `lib/permissions.ts` : `viewHistory` retiré de `OPERATIONAL_CAPABILITIES` (socle commun à directeur/placeur/agent scan) — ne reste que sur `admin` via `ALL_CAPABILITIES`. `/history` retiré de `FULL_STAFF_PREFIXES`/`SCAN_STAFF_PREFIXES` : un accès direct par URL pour un rôle non-admin est désormais renvoyé vers l'écran par défaut du rôle par le middleware, comme n'importe quel chemin hors matrice.
  - `app/api/history/route.ts` : remplace la liste de rôles en dur (`['admin', 'directeur', 'placeur', 'agent_checkin']`) par `hasCapability(user.role, 'viewHistory')` — capacité centralisée au lieu d'une liste dispersée (voir `CLAUDE.md`). Le raccourci du menu du compte (`AccountMenu.tsx`) n'a pas eu besoin de changer : il lisait déjà `hasCapability(role, 'viewHistory')`, donc il se met à jour tout seul.

### Tests
- `tests/navigation-resilience.test.ts` : 3 nouveaux tests (contraste/taille de la barre, bascule paysage sur les 9 écrans, bande d'info sur `/scan`).
- `tests/permissions.test.ts` : 1 nouveau test (`/history` réservé à l'admin, capacité centralisée sur la route API).
- `npx tsc --noEmit`, `npm run build`, 13 suites de tests (`node --test`) — tous exécutés avec succès.

### Migrations
- Aucune (changements d'interface et de capacités uniquement).

## [1.25.0] — 2026-08-30

Deux demandes de Gersom le 30/08/2026, à la suite du reste de la journée (v1.23.0/v1.24.0).

### Ajouté
- **Déplacer une personne seule vers une autre table.** Gersom, en observant que le renommage/ajout direct par personne (v1.23.0) donne enfin un nom à chaque membre : « ça va faciliter le transfert de personnes d'une table à une autre parce que maintenant on aura leurs noms » — confirmé vouloir la fonctionnalité complète, pas juste la remarque.
  - **`supabase/migrations/0031_split_guest_to_new_invitation.sql`** (appliquée en production) : nouvelle RPC `split_guest_to_new_invitation(guest_id, table_id, agent_id)` — détache la personne de son invitation source avec la même comptabilité que `remove_invitation_member` (ne redécompte pas `nombre_prevu` si elle était déjà `ne_viendra_pas`, décrémente `nombre_arrive` si elle était `arrive`), crée une **nouvelle invitation à une seule personne** à la table cible (`nombre_prevu = 1`, copie uniquement `category`/`cote` de la source — pas les tags/téléphone/email/notes, propres au foyer et non à la personne), puis reparente le lien `invitation_guests`. `arrival_status` de la personne n'est jamais modifié, seulement reparenté. Journalise `audit_logs` (`guest_split_move`).
  - **`app/api/members/move/route.ts`** (nouveau) : capacité `moveGuests` (mêmes rôles que le déplacement d'une invitation entière : admin/directeur/placeur).
  - **`app/tables/move-guest/[guestId]/page.tsx`** (nouveau) : reprend la structure de `/tables/move/[invitationId]` (sélection de table via `TablePicker`, capacités en direct) pour une personne au lieu d'un groupe entier ; renvoie vers la nouvelle fiche après déplacement. Pour regrouper la personne avec une invitation déjà présente à la table cible, utiliser ensuite « Fusionner avec un autre groupe » (fonctionnalité existante, pas dupliquée).
  - `components/GuestArrivalPanel.tsx` : bouton ⇄ par personne dans « Qui est arrivé ? », visible uniquement avec la capacité `moveGuests` (nouvelle prop `canMove`), à côté du bouton ✓.
  - `app/checkin/[invitationId]/page.tsx` : calcule `canMoveGuest = hasCapability(role, 'moveGuests')` et le transmet au panneau.
- **Bouton central de la barre de navigation adapté au rôle.** Gersom : « Pour le directeur des festins, Remy et Tuzola, s'assurer que… le bouton doré qui au milieu pourrait s'assurer le tableau de bord et non le scan » — leur travail commence par surveiller le remplissage des tables, pas par scanner des QR (le scan reste disponible en onglet latéral).
  - `components/BottomNav.tsx` : nouvelle table `CENTRAL_HREF` (par rôle) — `directeur` pointe vers `/dashboard`, tous les autres rôles gardent `/scan` par défaut. La répartition des 4 onglets restants (2 à gauche/2 à droite du bouton central) suit désormais un ordre canonique (`SIDE_ORDER`) au lieu d'être câblée uniquement autour de Scan, pour fonctionner quel que soit l'onglet choisi comme central.

### Tests
- `tests/guest-arrival-panel.test.ts` : 18 tests (3 nouveaux pour le déplacement par personne).
- `npx tsc --noEmit`, `npm run build`, 12 suites de tests (`node --test`) — tous exécutés avec succès.

### Migrations
- `0031_split_guest_to_new_invitation.sql` — appliquée en production (purement additive : nouvelle RPC, aucune donnée existante modifiée).

## [1.24.0] — 2026-08-30

Suite de [1.23.0] : Gersom a confirmé vouloir que « + Invité supplémentaire (non prévu) » ajoute une personne **nommée** tout en gardant le déclenchement de l'assignation de table de réserve en cas de dépassement — l'option que j'avais recommandée (par opposition à réutiliser tel quel `add_invitation_member`, qui augmente `nombre_prevu` et n'aurait donc jamais créé de dépassement).

### Ajouté
- **`supabase/migrations/0030_add_unplanned_arrival.sql`** : nouvelle RPC `add_unplanned_arrival(invitation_id, prenom, nom, agent_id)` — crée la personne directement en `arrival_status = 'arrive'`, incrémente `nombre_arrive` **sans jamais toucher `nombre_prevu`** (à la différence de `add_invitation_member`), recalcule `statut`, journalise dans `checkins` (pour rester cohérent dans `/history`) et `audit_logs` (`unplanned_arrival`). Un groupe déjà complet passe donc naturellement en excédent, exactement comme le faisait l'ancien `record_checkin` anonyme. **Appliquée en production** (migration purement additive, aucune donnée existante modifiée).
- **`app/api/members/add-unplanned/route.ts`** (nouveau) : capacité `checkin` (pas `manageMembers` — tout agent qui fait l'entrée doit pouvoir logger une arrivée imprévue, cohérent avec `/api/checkin`).
- `app/checkin/[invitationId]/page.tsx` : le bouton « + Invité supplémentaire (non prévu) » ouvre désormais un mini-formulaire prénom/nom (même style que le panneau « Qui est arrivé ? ») au lieu d'incrémenter directement un total anonyme ; après ajout, même logique qu'avant (vérifie le dépassement, ouvre l'assignation de table de réserve si besoin).

### Tests
- `tests/guest-arrival-panel.test.ts` : 15 tests (1 nouveau, 1 mis à jour pour retirer l'assertion sur l'ancien `onClick={() => handleAdd(1)}`).
- `npx tsc --noEmit`, `npm run build`, 12 suites de tests — tous exécutés avec succès.

## [1.23.0] — 2026-08-30

Gersom, avec deux captures d'écran d'une fiche de groupe (« Famille David Lukau ») : en ouvrant une fiche, deux écrans s'affichaient l'un après l'autre — l'ancien compteur agrégé « Personnes arrivées » d'abord, puis le nouveau panneau par-personne « Qui est arrivé ? ». Il a aussi demandé deux changements d'ergonomie sur ce panneau : taper le nom d'une personne pour le modifier directement (comme le titre de la fiche), et un bouton « + » pour ajouter quelqu'un sans passer par « Gérer les membres du groupe ».

### Corrigé
- **Cause racine du double affichage** : `GuestArrivalPanel` prévenait le parent (`onVisibilityChange`) dès que `loading` passait à `false` — ce qui arrive dès le tout premier chargement, avant même de savoir si la liste va se matérialiser depuis les notes (« Membres: ... »). Pendant cette fenêtre, `members.length` valait `0`, donc le parent recevait à tort « pas de liste » et affichait le vieux compteur agrégé, avant de re-basculer vers le panneau par-personne une fois les données réellement arrivées.
- `components/GuestArrivalPanel.tsx` : `onVisibilityChange` n'est plus appelé qu'une fois l'état vraiment stabilisé (chargement **et** matérialisation éventuelle depuis les notes tous les deux terminés — nouvel indicateur `settled`), jamais à une étape intermédiaire. Le message « Chargement des membres… » reste affiché pendant toute cette fenêtre au lieu de basculer prématurément.

### Ajouté
- **Renommer une personne directement** : taper son nom dans « Qui est arrivé ? » fait apparaître deux champs (prénom/nom) en édition sur place, comme le titre de la fiche (même API `/api/members/rename`) — réservé aux rôles avec la capacité `manageMembers` (même garde que « Gérer les membres du groupe »).
- **Ajouter une personne directement** : bouton « + » sous la liste (même capacité `manageMembers`) qui ouvre un mini-formulaire prénom/nom et ajoute la personne via `/api/members/add` (`add_invitation_member`, inchangé) — apparaît aussitôt dans la liste avec ses boutons ✓/✕.

### Non traité dans ce lot — à confirmer
Gersom a aussi décrit un changement plus profond : que le bouton « + Invité supplémentaire (non prévu) » (actuellement un compteur anonyme qui incrémente `nombre_arrive` et peut déclencher l'assignation à une table de réserve en cas de dépassement) devienne lui aussi un ajout **nommé**, tout en gardant le déclenchement de l'assignation de table en cas de dépassement de capacité. `add_invitation_member` (utilisé par le bouton « + » ci-dessus) augmente `nombre_prevu` en même temps qu'il ajoute la personne — ce qui ne crée jamais de dépassement, donc ne déclenche jamais l'assignation de table, contrairement au comportement actuel de « + Invité supplémentaire ». Faire les deux à la fois (nommé **et** déclencheur d'excédent) demanderait une nouvelle règle métier/RPC — non implémenté sans confirmation explicite, pour ne pas modifier silencieusement le calcul de capacité d'un mariage en préparation.

### Tests
- `tests/guest-arrival-panel.test.ts` : 14 tests (2 nouveaux, 1 mis à jour pour le nouveau `settled`).
- `npx tsc --noEmit`, `npm run build`, 12 suites de tests — tous exécutés avec succès.

## [1.22.0] — 2026-08-30

Gersom a fourni un prompt de handoff complet (« thème Atrium / Maison ») demandant de remplacer toute la charte visuelle par un système à deux modes — Atrium (clair, accent indigo) et Maison (sombre, accent champagne) — avec écran de choix à la première connexion et préférence Sombre/Clair/Auto. Confirmé explicitement avec lui avant de commencer : le prompt ciblait une base stale (« 1.19.3 → 1.20.0 »), alors que le thème « Glass Sombre » (charcoal/teal/or, v1.20.0) était déjà en production et en usage réel — décision prise de le remplacer entièrement plutôt que de le fusionner, sur choix explicite de Gersom.

Première passe faite sans accès à la maquette (`Propositions.dc.html`, `Ecrans Atrium Maison.dc.html` non accessibles depuis l'outil) : détails visuels conçus au mieux. Gersom a ensuite exporté `Ecrans Atrium Maison.dc.html` (maquette Claude Design, tours 3-4 : connexion, recherche, historique, plan de table, tableau de bord, staff) — rendue avec Playwright (le fichier est un bundle auto-porté qui se déballe en JS) pour comparer pixel par pixel et corriger les écarts avant merge. Voir « Corrigé — passage à la maquette Claude Design » ci-dessous.

### Ajouté
- **Système de tokens CSS à deux modes** (`app/globals.css`, `tailwind.config.ts`) : toutes les couleurs passent désormais par des variables (`--bg`, `--surface`, `--text`, `--accent`, `--hairline`, `--elev-1/2`, `--glass`…) redéfinies sous `[data-theme='light']` (Atrium) et `[data-theme='dark']` (Maison), exposées comme couleurs Tailwind (`bg-bg`, `text-text`, `border-hairline`, `bg-accent`…). Remplace entièrement l'ancienne palette codée en dur (`parchment`, `ink`, `gold`, `night`, `cream`, et le `charcoal`/`teal` de Glass Sombre v1.20.0), supprimée de `tailwind.config.ts`.
- `hooks/useTheme.ts` : préférence à 3 valeurs (`ThemePref = 'light' | 'dark' | 'system'`, avant 2). `'system'` suit `prefers-color-scheme` en direct via `matchMedia().addEventListener('change', …)`, abonnement actif uniquement pour ce mode. Pose `data-theme` **et** met à jour `<meta name="theme-color">` à chaque changement. Clé localStorage `checkin-theme` inchangée — une ancienne valeur `'light'`/`'dark'` reste une préférence valide, aucune migration active nécessaire.
- **`app/onboarding/theme/page.tsx`** (nouveau) : écran de choix Sombre/Clair/Automatique affiché une seule fois, juste après la toute première connexion réussie (drapeau `checkin-theme-chosen` en localStorage), avant d'atterrir sur `landingPathForRole(role)` — jamais une route en dur. `app/login/page.tsx` y redirige (en conservant `?next=`) uniquement si le drapeau est absent ; `middleware.ts` laisse passer `/onboarding` pour tout rôle authentifié (pure préférence d'affichage, hors de `lib/permissions.ts`, non modifié).
- `components/AccountMenu.tsx` : le bascule 2 boutons (Clair/Sombre) de v1.20.0 devient un segmented control à 3 positions (Sombre/Clair/Auto, `role="radiogroup"`).
- `components/BottomNav.tsx` : bouton Scan central surélevé (66px, `bg-accent`) à la place d'un onglet parmi d'autres ; les autres onglets se répartissent 2 à gauche/2 à droite. `visibilite` (pas de capacité `scan`) garde une barre plate à 3 onglets, sans bouton central. Nouvelles icônes `components/icons.tsx` (SVG inline, style trait + remplissage léger) à la place des glyphes texte `▣ ⌕ ▦ ◔`.
- `components/MessageButton.tsx` : l'action WhatsApp devient une pastille verte officielle (`#25D366`, 44px) avec combiné blanc en SVG, au lieu d'une bulle emoji teintée — seule couleur de marque à ne pas passer par les tokens de thème.
- `tests/theme-preference.test.ts` (nouveau, 9 tests) : résolution `system`, réaction `matchMedia`, persistance, absence de migration active, onboarding une seule fois, bypass middleware, segmented control.

### Changé
- **Toutes les pages de l'application** (`app/**`, `components/**`) reskinnées sur les nouveaux tokens — page de connexion incluse : elle suit désormais elle aussi Atrium/Maison (halo champagne + ciel étoilé uniquement en Maison, carte neutre en Atrium), remplaçant le traitement « toujours Verre Doré » fixé en v1.20.0 à la demande explicite de Gersom du 29/08/2026 — changement de direction confirmé avec lui pour ce prompt.
- `.btn-primary`, `.btn-secondary`, `.card`, `.action-row(-muted)` : mêmes noms de classes qu'avant (pour ne pas toucher tout le JSX), règles réécrites sur les variables. `.card-night` supprimée (plus d'écran « fond nuit » fixe : c'est le thème qui décide) ; ses usages migrés vers `.card`.
- `public/manifest.json` : `theme_color`/`background_color` alignés sur le token `--bg` d'Atrium (`#f4f4f7`), cohérent avec la valeur par défaut de `viewport.themeColor` dans `app/layout.tsx`.
- `tests/dashboard-liste-cote-filter.test.ts`, `tests/floor-plan.test.ts` : mis à jour pour la nouvelle classe de l'état actif (`border-accent bg-accent text-on-accent`, avant `border-ink bg-ink text-white`) — même comportement, nouveau nom de token.

### Corrigé au passage
- La sélection de table de réserve dans le flux d'excédent (`app/checkin/[invitationId]/page.tsx`) avait perdu son indicateur de sélection (bordure colorée) pendant la conversion automatique des tokens — corrigé avant merge (`border-accent`, pas `border-hairline`).
- Plusieurs badges/bascules teintés (étiquettes, mode de recherche, filtres) avaient été convertis par erreur en remplissage plein (`bg-accent`) au lieu d'un fond teinté (`bg-accent-tint`), ce qui aurait rendu le texte illisible en Maison (texte accent sur fond accent plein) — détecté et corrigé avant merge en comparant chaque cas au diff d'origine.
- `.eyebrow` (utilisée depuis avant v1.20.0 sur `/login`, `/scan`, `/placement`) n'avait jamais été définie en CSS — classe sans effet. Définie pour de bon.
- `components/SplashScreen.tsx` : couleur de secours avant chargement de l'image passe de `#1a2942` (ancien token `ink`, supprimé) à `bg-bg`.

### Corrigé — passage à la maquette Claude Design
- `components/BottomNav.tsx` : la maquette montre un **5ᵉ onglet « Staff »** (icône liste) à droite du bouton Scan central, sur les 5 écrans capturés (recherche, historique, plan de table, tableau de bord, staff eux-mêmes) — absent de la première passe (aucun onglet Staff n'existait avant). Ajouté pour tout rôle ayant la capacité `viewStaff`, y compris `visibilite` (barre plate à 4 onglets, toujours sans bouton Scan). Nouvelle icône `StaffIcon`.
- `app/login/page.tsx` : la maquette ne montre ni ciel étoilé ni trajectoire pointillée en Maison — juste un halo discret derrière le sceau. `StarField`/`FlightPath` retirés (composants conservés dans `components/BrandMotif.tsx`, déjà un motif de fichiers décoratifs non utilisés dans ce projet, ex. `EiffelSilhouette`).
- Distinction confirmée par la maquette entre deux usages du même token `bg-accent-tint` posé un peu vite lors de la première passe : un **contrôle segmenté « quel mode est actif »** (bascule de recherche par nom/téléphone/email, bascule scan/recherche de `/placement`) doit être en **remplissage plein** (`bg-accent text-on-accent`), pas teinté — corrigé dans `app/search/page.tsx` (3 boutons) et `app/placement/page.tsx` (2 boutons). Les cartes de sélection multi-lignes (fusion de groupe, choix de table de réserve/excédent) restent teintées : aucune preuve visuelle contraire, et texte multi-ligne moins lisible en remplissage plein.
- `components/CapacityGauge.tsx` et la barre « Placement & présence » de `app/plan-table/page.tsx` (`CapacityBar`) : la jauge « hero » (remplissage de la salle) passe en accent (champagne) plutôt qu'en vert fixe quand elle est en dessous des seuils d'alerte, en Maison uniquement — confirmé sur `/dashboard` et `/plan-table`. Les états d'alerte (ambre ≥75 %, rouge en dépassement) restent des couleurs de sécurité universelles, inchangées dans les deux modes ; toujours vrai pour les vrais badges de statut (`StatusBadge`, jamais accent) et les jauges par table (toujours vert/rouge fixe).
- `components/MessageButton.tsx` : nouveau `CallButton` exporté — pastille pleine `--status-complete` (verte, universelle) avec combiné blanc en SVG, à la place de l'emoji 📞 sur fond teinté. Utilisé dans `app/staff/page.tsx` et les deux occurrences de `app/plan-table/page.tsx` (taille compacte).
- `tests/permissions.test.ts` : regex assouplie pour le bouton d'appel du staff (plus de balise multi-ligne obligatoire depuis l'extraction en `CallButton`).
- `app/plan-table/page.tsx` : le libellé « Placement & présence » passe en accent en Maison (`dark:text-accent`), confirmé sur deux captures distinctes de la même maquette (export `.dc.html` puis captures de l'app Claude Design elle-même sur iPhone).
- `app/history/page.tsx` : ligne réorganisée en deux colonnes (nom + table à gauche, montant coloré à droite) avec une pastille de couleur devant le nom — réutilise les couleurs déjà correctes par type d'action (vert = arrivée, rouge = excédent), pas de nouvelle logique. Au passage : la correction utilisait `status-partial` (ambre, une couleur d'avertissement) alors que la maquette la montre en gris neutre — une correction n'est pas une alerte opérationnelle, changé en conséquence.

### Corrigé — mise en page plein écran (web large / paysage)
Gersom a signalé (capture d'écran à l'appui, `/scan` sur iPad en paysage) que le bouton « Staff » passait sous la ligne de flottaison sans pouvoir défiler jusqu'à lui, et a demandé que toutes les pages tiennent sur un seul écran sans défilement pour atteindre les boutons du bas, y compris après rotation de l'appareil. C'est la tâche « orientation/paysage » explicitement mise de côté le 29/08/2026 — remise sur la table pour les écrans à barre de navigation basse.

- **Nouveau patron** appliqué à `/dashboard`, `/staff`, `/plan-table` (déjà conforme), `/search`, `/scan`, `/history`, `/exceptions`, `/placement`, `/admin` : conteneur racine `h-dvh overflow-hidden` (hauteur exacte de la fenêtre, plus `min-h-dvh` qui grandissait avec le contenu) au lieu de `min-h-dvh` ; la zone de contenu entre l'en-tête et la barre du bas passe en `flex-1 overflow-y-auto` (défile seule). En-tête et barre du bas restent toujours visibles, sur toute taille/orientation d'écran — pas de nouveau composant partagé, patron répété à l'identique sur chaque page pour rester cohérent avec le reste du code.
- `app/scan/page.tsx` : les 4 boutons dupliqués (Rechercher/Plan/Tableau de bord/Staff) sont retirés au profit de la barre du bas partagée (`BottomNav`, déjà sur les autres écrans) — en plus de régler le problème signalé, ça rend `/scan` cohérent avec le reste de l'appli (bouton Scan central déjà utilisé pour y revenir depuis les autres pages).
- `app/search/page.tsx` : n'avait jamais eu `BottomNav` alors que la maquette Atrium/Maison le montre sur cet écran (confirmé sur les deux exports) — ajouté.
- `tests/navigation-resilience.test.ts` : assertion mise à jour (`/scan` utilise désormais `<BottomNav>` au lieu d'un lien direct vers `/plan-table`).

### Corrigé — structure de contenu (pas seulement les couleurs)
- `app/dashboard/page.tsx` : les blocs « Staff » et « Tables de réserve » (deux titres séparés) fusionnent sous un seul en-tête uppercase « Staff & réserve » (« Tables de réserve » seul si le rôle ne voit pas Staff), accent en Maison — comme les autres en-têtes de section de la maquette.
- `app/history/page.tsx` : les entrées sont désormais regroupées par jour calendaire (« Ce soir », « Hier », ou la date) avec un compte d'actions en en-tête de groupe — au lieu d'une liste plate, comme le montre la maquette (« CE SOIR · 96 ACTIONS »).

### Contraintes respectées
- Aucune modification de `lib/permissions.ts`, des routes `app/api/**`, des migrations SQL, ni de la logique temps réel (debounce, refetch au focus, pull-to-refresh).
- Statuts opérationnels (`status-none/partial/complete/over`, couleurs Nelly/Gégé) inchangés dans les deux modes, comme demandé — la seule exception est la jauge de remplissage de salle elle-même (voir ci-dessus), qui n'est pas un badge de statut mais un élément décoratif de marque.

### Tests
- `tests/theme-preference.test.ts` (9, nouveau), `tests/dashboard-liste-cote-filter.test.ts`, `tests/floor-plan.test.ts` et `tests/permissions.test.ts` mis à jour — 12 suites au total, toutes vertes après le passage à la maquette Claude Design.
- `npx tsc --noEmit`, `npm run build` (62 routes, y compris `/onboarding/theme`) — tous exécutés avec succès.
- `/login` vérifiée visuellement (Playwright, `npm run build && npm run start`) dans les deux modes contre les captures de la maquette.

## [1.21.1] — 2026-08-29

Bug trouvé par Gersom **en production**, quelques minutes après le déploiement de v1.21.0 : sur « Famille Guygson Vemba » (2 prévues), marquer Mona en ✕ (« ne viendra pas ») faisait tomber `nombre_prevu` à 1 comme prévu — mais `GuestArrivalPanel` ET la page de check-in décidaient toutes les deux d'afficher la liste par personne uniquement quand `nombre_prevu > 1`. Résultat : dès que Mona passait en ✕, le panneau entier disparaissait (elle avec), l'écran retombait sur l'ancien compteur +/- (qui ne sait rien des personnes), et il n'y avait plus aucun moyen de la remettre — « on est un peu dans le pétrin ».

### Corrigé
- **Cause racine** : `nombre_prevu` n'est pas un bon signal de « ce groupe a une liste de membres » — il baisse justement à chaque personne marquée `ne_viendra_pas`, par conception (v1.21.0). Un groupe de 2 tombe à `nombre_prevu = 1` dès la première exclusion, ce qui déclenchait à tort le repli vers l'ancien compteur solo.
- `components/GuestArrivalPanel.tsx` : la visibilité du panneau se base maintenant sur `members.length > 0` (la liste réelle chargée/initialisée), plus jamais sur `invitation.nombre_prevu`. Signale son état réel au parent via une nouvelle prop `onVisibilityChange`.
- `app/checkin/[invitationId]/page.tsx` : nouvel état `hasMemberList` (initialisé à `true`, optimiste — pas de flash vers l'ancien compteur pour la majorité des groupes pendant le premier chargement), mis à jour par `GuestArrivalPanel`. Remplace les trois conditions qui utilisaient `invitation.nombre_prevu > 1`/`<= 1` (bouton « Cet invité ne viendra pas », choix compteur vs « + Invité supplémentaire », bouton « Confirmer » du bas).
- **Aucune réparation de données nécessaire** : le bug était uniquement dans l'affichage — Mona existait toujours en base avec `arrival_status = 'ne_viendra_pas'`, `nombre_prevu` était correctement à 1. Une fois le correctif déployé, rouvrir la fiche réaffiche Suzie ET Mona (grisée, toujours réversible en retapant ✓ ou ✕) sans aucune intervention manuelle en base.

### Tests
- `tests/guest-arrival-panel.test.ts` : 2 tests remplacés, 2 ajoutés (11 au total) — visibilité basée sur `members.length`, jamais sur `nombre_prevu`, dans les deux fichiers.
- `npx tsc --noEmit`, `npm run build`, les 11 suites de tests (`test:roles`, `test:withjoy`, `test:members`, `test:floorplan`, `test:diffusion`, `test:navigation`, `test:realtime`, `test:searchnames`, `test:sortlabel`, `test:arrival`, `test:listecote`) — tous exécutés avec succès.

## [1.21.0] — 2026-08-29

Gersom, en regardant le panneau « Qui ne vient pas dans ce groupe ? » (déjà par-membre) sur un groupe de 5 : « on ne veut pas savoir le nombre de personnes, on veut savoir c'est qui ». Le compteur agrégé « Personnes arrivées » (+/-) ne dit jamais QUI parmi les personnes nommées est arrivé — juste un total. Remplacé par une case à cocher par personne, à trois états, réversible à tout moment.

### Changé (rupture de comportement pour les groupes)
- **`supabase/migrations/0029_guest_arrival_status.sql`** : nouvelle colonne `guests.arrival_status` (`attendu` par défaut, `arrive`, `ne_viendra_pas`) et nouvelle RPC `set_guest_arrival_status` — calcule elle-même les deltas sur `nombre_prevu`/`nombre_arrive` à partir de l'ancien ET du nouvel état (gère `attendu↔arrive`, `attendu↔ne_viendra_pas`, et le cas direct `arrive↔ne_viendra_pas`), idempotente, journalise dans `checkins`/`audit_logs` comme le reste de l'app. **Contrairement à l'ancien panneau « Qui ne vient pas » (`LiberationPlacesPanel`, retiré) : la personne n'est jamais supprimée** — son état reste visible (grisé si `ne_viendra_pas`) et se rebascule en retapant le même bouton, sans mécanisme d'annulation séparé à part.
- `remove_invitation_member` (mise à jour) : une suppression définitive depuis « Gérer les membres du groupe » reste maintenant cohérente avec `arrival_status` — ne redécompte plus `nombre_prevu` pour une personne déjà `ne_viendra_pas` (sinon double-décompte), et sort aussi `nombre_arrive` pour une personne `arrive` (sinon `nombre_arrive` pouvait dépasser `nombre_prevu` après suppression).
- `components/GuestArrivalPanel.tsx` (nouveau, remplace `LiberationPlacesPanel.tsx`, retiré) : matérialise la liste « Membres: ... » en lignes réelles dès l'ouverture de la fiche (plus besoin d'une première action pour avoir des noms), puis un bouton ✓ (vert, arrivé) et ✕ (rouge, ne viendra pas) par personne — mise à jour optimiste, instantanée, sans écran de confirmation plein écran.
- `app/checkin/[invitationId]/page.tsx` : pour un groupe (`nombre_prevu > 1`), le compteur +/- et le bouton « Confirmer l'arrivée » disparaissent complètement au profit de `GuestArrivalPanel` — seul reste un bouton explicite « + Invité supplémentaire (non prévu) » pour le cas d'un invité non prévu qui se présente (réutilise le flux d'excédent/débordement existant, inchangé). **Pour une invitation solo (`nombre_prevu <= 1`), rien ne change** : compteur, bouton « Confirmer » et « Cet invité ne viendra pas » restent exactement comme avant — cas déjà non ambigu (0 ou 1 personne), hors du périmètre de la demande.
- « Cet invité ne viendra pas » (l'invitation entière) se cache désormais dès qu'il y a plusieurs personnes nommées (le détail par personne suffit), au lieu de dépendre d'un signal asynchrone du panneau — condition simplifiée, purement synchrone.

### Non fait (portée volontairement limitée à cette version)
- Aucune tentative de reconstituer QUI était arrivé pour les groupes ayant déjà un `nombre_arrive > 0` avant cette version (impossible à déduire d'un simple total) — sans impact aujourd'hui : production toujours en statut `test`, 0 arrivée réelle au moment du déploiement.
- Les invitations solo gardent l'ancien mécanisme inchangé (voir ci-dessus).

### Tests
- `tests/guest-arrival-panel.test.ts` (nouveau, 8 tests, remplace `tests/liberation-undo.test.ts` retiré) : absence de `CounterStepper`/suppression de membre dans le nouveau panneau, bascule vers `attendu` si déjà actif, matérialisation immédiate depuis les notes, calcul des deltas et idempotence côté SQL, garde anti double-décompte dans `remove_invitation_member`, condition de repli synchrone pour « ne viendra pas », bouton « + Invité supplémentaire » pour les groupes.
- Migration `0029` appliquée et vérifiée en production par un scénario de bout en bout sur une invitation de test (créée puis entièrement supprimée après coup) : `attendu→arrive` (+1 arrivée), `attendu→ne_viendra_pas` (place libérée), rejeu du même état (idempotent, aucune ligne d'audit dupliquée), annulation dans les deux sens, transition directe `arrive→ne_viendra_pas` (les deux compteurs bougent ensemble), puis suppression définitive dans les deux états (`ne_viendra_pas` : pas de double-décompte de `nombre_prevu` ; `arrive` : `nombre_arrive` sort bien) — tous les totaux obtenus correspondent exactement au calcul attendu.
- `npx tsc --noEmit`, `npm run build`, `npm run test:roles` (15/15), `npm run test:withjoy` (12/12), `npm run test:members` (3/3), `npm run test:floorplan` (18/18), `npm run test:diffusion` (5/5), `npm run test:navigation` (4/4), `npm run test:realtime` (6/6), `npm run test:searchnames` (4/4), `npm run test:sortlabel` (1/1), `npm run test:arrival` (8/8), `npm run test:listecote` (4/4) — tous exécutés avec succès.

## [1.20.0] — 2026-08-29

Gersom a demandé un thème sombre façon Liquid Glass/iOS après avoir comparé 3 pistes visuelles sur un canevas de maquettes, avec un choix explicite laissé aux utilisateurs (menu de compte) plutôt qu'un thème unique imposé.

### Ajouté
- `hooks/useTheme.ts` (nouveau) : préférence clair/sombre par appareil, persistée dans `localStorage` (`checkin-theme`), jamais liée à `prefers-color-scheme` du système — l'appli ne doit pas changer d'apparence toute seule pendant l'événement.
- `app/layout.tsx` : script bloquant minimal dans `<head>` posant `data-theme="dark"` avant le premier rendu (évite un flash clair→sombre à l'ouverture), en phase avec `hooks/useTheme.ts` (même clé, mêmes valeurs).
- `tailwind.config.ts` : `darkMode: ['selector', '[data-theme="dark"]']` + nouvelle palette `charcoal`/`teal` (charbon neutre + accent sarcelle) pour le thème sombre, distincte de la palette `night`/`gold` déjà utilisée sur l'écran de connexion (non touchée).
- `components/AccountMenu.tsx` : sélecteur « ☀ Clair / ● Sombre » dans le menu de compte (à côté de la déconnexion), état actif visible, changement immédiat sans rechargement.
- `app/globals.css` : variantes `dark:` pour `.btn-primary` (dégradé or→sarcelle), `.btn-secondary`, `.card`, `body` ; deux nouvelles classes `.action-row`/`.action-row-muted` — les actions secondaires du check-in (« Gérer les membres du groupe », « Cet invité ne viendra pas ») étaient de simples liens soulignés, elles se lisent maintenant comme de vrais boutons cliquables (fond, bordure, ombre) dans les deux thèmes, retour direct de Gersom sur la maquette.
- `app/checkin/[invitationId]/page.tsx`, `components/TopBar.tsx` : déclinaison sombre complète de l'écran de check-in (carte info, étiquettes, formulaire de renommage, notice de synchronisation) en plus des deux boutons d'action ci-dessus.

### Non fait (portée volontairement limitée à cette version)
- Seul l'écran de check-in a reçu une déclinaison sombre complète et bespoke. Les autres pages (`/dashboard`, `/plan-table`, `/search`, `/tables`, `/staff`, `/admin/*`...) héritent automatiquement des variantes sombres de `.card`/`.btn-primary`/`.btn-secondary` (utilisées par 35 fichiers) mais n'ont pas été vérifiées écran par écran — à faire au fur et à mesure des retours.
- L'écran de connexion garde son apparence actuelle (déjà sombre en permanence) quel que soit le thème choisi : le sélecteur n'est accessible qu'après connexion.

### Tests
- `npx tsc --noEmit`, `npm run build` (compile les classes `dark:` — vérifié dans le CSS généré), `npm run test:roles` (15/15), `npm run test:withjoy` (12/12), `npm run test:members` (3/3), `npm run test:floorplan` (18/18), `npm run test:diffusion` (5/5), `npm run test:navigation` (4/4), `npm run test:realtime` (6/6), `npm run test:searchnames` (4/4), `npm run test:sortlabel` (1/1), `npm run test:liberation` (4/4), `npm run test:listecote` (4/4) — tous exécutés avec succès. Pas de test automatisé dédié au rendu visuel du thème (composants React non couverts par la suite actuelle, comme le reste de l'UI) — à vérifier à l'œil dans l'appli réelle.

## [1.19.3] — 2026-08-28

Gersom a signalé, juste après l'ajout du filtre par côté sur `/dashboard/liste`, que le total « 399 personnes » mélange invités et staff sans distinction possible.

### Ajouté
- `app/dashboard/liste/page.tsx` : quatrième pastille « Staff » dans la rangée de filtre (Toutes/Côté Nelly/Côté Gégé/Staff), isolant les invitations `category === 'Staff'` — même comportement que les filtres de côté : les tuiles de stats reflètent le filtre actif, y compris quand « Staff » est sélectionné.

### Tests
- `tests/dashboard-liste-cote-filter.test.ts` : +1 test pour le filtre Staff (4 tests au total).
- `npx tsc --noEmit`, `npm run test:listecote` (4/4), `npm run test:roles` (15/15), `npm run test:floorplan` (18/18), `npm run test:members` (3/3), `npm run test:diffusion` (5/5), `npm run test:withjoy` (12/12), `npm run test:navigation` (4/4), `npm run test:realtime` (6/6), `npm run test:searchnames` (4/4), `npm run test:sortlabel` (1/1), `npm run test:liberation` (4/4) et `npm run build` tous exécutés avec succès.

## [1.19.2] — 2026-08-28

Gersom a demandé le même filtre par côté (Nelly/Gégé) sur les listes détaillées du dashboard (`/dashboard/liste` — invités restants, arrivés, tous, etc.), qui affichent les mêmes tuiles personnes/côté Nelly/côté Gégé que `/plan-table` sans aucun moyen de filtrer.

### Ajouté
- `app/dashboard/liste/page.tsx` : filtre par côté (Toutes/Côté Nelly/Côté Gégé), même design que `/plan-table` depuis v1.19.1 — pastilles dédiées avec état actif net (fond plein), pas des tuiles cliquables à l'état peu visible. Les tuiles de stats (personnes, côté Nelly, côté Gégé) reflètent le filtre actif, comme la liste juste en dessous. Le filtre est toujours visible même sans résultat pour cette combinaison (sinon aucun moyen de revenir à « Toutes »), et se réinitialise en changeant de liste (restants → arrivés, etc.) pour éviter qu'un filtre oublié fasse croire une liste incomplète.

### Tests
- `tests/dashboard-liste-cote-filter.test.ts` (nouveau, 3 tests) : filtre présent avec le bon design, réinitialisation au changement de `type`, rangée de filtre jamais masquée par l'absence de résultat.
- `npx tsc --noEmit`, `npm run test:listecote` (3/3), `npm run test:roles` (15/15), `npm run test:floorplan` (18/18), `npm run test:members` (3/3), `npm run test:diffusion` (5/5), `npm run test:withjoy` (12/12), `npm run test:navigation` (4/4), `npm run test:realtime` (6/6), `npm run test:searchnames` (4/4), `npm run test:sortlabel` (1/1), `npm run test:liberation` (4/4) et `npm run build` tous exécutés avec succès.

## [1.19.1] — 2026-08-28

Gersom a fait un vrai import CSV (`guestlist_38.csv`) via `/admin/import-withjoy` et confirmé que l'aperçu (points à vérifier, avertissements) fonctionnait bien. Retour ensuite sur les tuiles cliquables de `/plan-table` ajoutées en v1.19.0 : trop grosses, aucun état actif visible (impossible de voir sur quelle tuile on vient de cliquer), et l'incohérence de position (les tuiles ne sont pas toutes à la même place selon leur contenu) rendait l'interaction peu claire.

### Corrigé
- `/plan-table` : les filtres côté Nelly/Gégé et confirmées/provisoires quittent les tuiles de statistiques (qui redeviennent un simple affichage, plus des `<button>`) pour une **rangée de pastilles dédiée**, positionnée près des boutons « Trier par… » — même emplacement stable pour tous les filtres, avec un état actif net (fond plein `border-ink bg-ink text-white`, repris de l'ancienne rangée « Toutes les places / Confirmée / Provisoire ») au lieu d'un simple contour peu visible autour d'une tuile.
- Les tuiles de statistiques (personnes, côté Nelly/Gégé, confirmées/provisoires) reflètent désormais le filtre actif (`tileStats`, calculé sur le sous-ensemble filtré) — cliquer un filtre « élimine » visiblement le reste directement dans ces chiffres, pas seulement dans les cartes de table plus bas.
- Corrigé au passage : deux mentions de version internes à `docs/BUSINESS_RULES.md` et `docs/QA_SCENARIOS.md` avaient été bumpées par erreur de 1.19.0 à 1.19.1 par un remplacement global ; remises à 1.19.0 (date réelle de ces règles).

### Tests
- `tests/floor-plan.test.ts` : le test des tuiles-boutons est remplacé par deux tests (rangée de filtres dédiée avec état actif net ; tuiles reflétant `tileStats`) — 18 tests au total (+1).
- `npx tsc --noEmit`, `npm run test:roles` (15/15), `npm run test:floorplan` (18/18), `npm run test:members` (3/3), `npm run test:diffusion` (5/5), `npm run test:withjoy` (12/12), `npm run test:navigation` (4/4), `npm run test:realtime` (6/6), `npm run test:searchnames` (4/4), `npm run test:sortlabel` (1/1), `npm run test:liberation` (4/4) et `npm run build` tous exécutés avec succès.

## [1.19.0] — 2026-08-28

Demande vocale de Gersom en testant l'app comme un invité, sur `/plan-table` et `/checkin/[invitationId]` : filtrer rapidement par côté, réduire l'espace pris par les stats/barres/boutons redondants, corriger le sens de « Provisoire », et pouvoir annuler une libération de place. Détail des décisions ci-dessous.

### Changé (règle métier)
- **`placement_status` reflète désormais la confiance RSVP, plus le fait que la table vienne d'un tag CSV explicite ou de l'algorithme.** Avant cette version, un tag `T0xx`/`F0xx` suffisait à rendre une invitation « Confirmée », sans égard au RSVP — ce qui rendait le filtre « Provisoire » quasi vide (11 personnes sur 380) et ne correspondait pas à ce qu'on voulait y voir. Nouvelle règle (confirmée avec Gersom avant d'y toucher, car elle change un comportement documenté et utilisé ailleurs dans l'app) : `confirmee` seulement si CHAQUE membre du groupe a une réponse RSVP commençant par « Oui » (le texte With Joy réel est « Oui, embarquement confirmé », pas une égalité stricte), sinon `provisoire` (réponse « Peut-être », ou aucune donnée RSVP disponible). Appliquée dans `lib/withjoyImport.ts` (import CSV), `app/api/admin/import-withjoy/route.ts` (invitations sans table) et `scripts/assign_tables_from_labels.py` (script offline), pour éviter la divergence entre ces trois implémentations de la même règle.
- `supabase/migrations/0028_rsvp_based_placement_status.sql` (**appliquée en production**) recalcule les 243 invitations existantes avec la nouvelle règle, pour que l'affichage reste cohérent immédiatement plutôt que d'attendre le prochain réimport CSV. Prévisualisé avant application (170 restent confirmée, 62 passent confirmée→provisoire, 7 passent provisoire→confirmée, 4 restent provisoire) puis vérifié après (177/261 confirmée, 66/119 provisoire). L'état pré-migration est sauvegardé dans `placement_status_backup_20260828` (accès `service_role` uniquement) pour un retour arrière exact si nécessaire.

### Ajouté
- `/plan-table` : les tuiles de statistiques (« X côté Nelly »/« X côté Gégé ») filtrent désormais les invitations affichées dans chaque table (sans masquer les tables elles-mêmes, l'organisation par table reste intacte) — retaper la même tuile revient à « toutes ». Même mécanique pour les tuiles « places confirmées »/« places provisoires », qui remplacent l'ancienne rangée de boutons « Toutes les places / Confirmée / Provisoire ».
- Une seule barre de progression (`CapacityBar`) remplace les deux barres séparées, à la fois sur chaque carte de table et dans le récapitulatif en haut de page : un trait marque le nombre prévu, le remplissage suit les arrivées et passe au rouge dès qu'il dépasse ce trait — sans texte supplémentaire à lire. Le texte « 369/400 places officielles (40 tables) » et les deux anciennes barres séparées (« Placement prévu »/« Présence actuelle ») sont retirés, leur contenu utile (réserve, sans-table) réduit à une seule ligne de légende.
- `/checkin/[invitationId]` (`components/LiberationPlacesPanel.tsx`) : libérer une ou plusieurs places dans « Qui ne vient pas dans ce groupe ? » propose désormais un bouton « ↩️ Annuler » qui remet exactement les mêmes personnes (prénom + nom capturés avant la suppression, pas redécoupés depuis le nom affiché). Avant cette version, une fois une place libérée, la seule façon de revenir en arrière était de repasser par « Gérer les membres du groupe » et retaper le nom à la main.
- « Cet invité ne viendra pas » (qui gère l'invitation entière) se cache désormais quand `LiberationPlacesPanel` affiche déjà sa liste de membres à décocher pour ce groupe — redondant sinon. Reste toujours visible pour une invitation seule (le panneau par-membre ne s'affiche jamais dans ce cas) et pour annuler un marquage déjà posé, quel que soit l'état du panneau.

### Tests
- `tests/withjoy-import.test.ts` : +1 test couvrant la nouvelle règle RSVP (tag explicite + RSVP Peut-être → provisoire ; sans tag + RSVP Oui → confirmee ; groupe mixte → provisoire).
- `tests/floor-plan.test.ts` : +3 tests (tuiles de stats devenues des filtres, filtre par côté appliqué table par table et sur sans-table, `CapacityBar` unique réutilisée 2 fois avec dépassement en rouge) ; test existant sur « Placement prévu »/« Présence actuelle » mis à jour pour la barre unique.
- `tests/liberation-undo.test.ts` (nouveau, 4 tests) : bouton Annuler présent et fonctionnel, prénom/nom capturés avant suppression, `lastReleased` jamais effacé par un rechargement temps réel, visibilité correcte de « Cet invité ne viendra pas ».
- `npx tsc --noEmit`, `npm run test:roles` (15/15), `npm run test:floorplan` (17/17), `npm run test:members` (3/3), `npm run test:diffusion` (5/5), `npm run test:withjoy` (12/12), `npm run test:navigation` (4/4), `npm run test:realtime` (6/6), `npm run test:searchnames` (4/4), `npm run test:sortlabel` (1/1), `npm run test:liberation` (4/4) et `npm run build` tous exécutés avec succès.

## [1.18.4] — 2026-08-28

### Corrigé
- `/plan-table` affiche maintenant le mode de tri actif juste au-dessus des cartes : « triées par numéro, 1 → 40 » ou « triées par places libres (pas par numéro) ». La logique de tri elle-même reste inchangée.

### Tests
- Nouveau test `tests/plan-table-sort-label.test.ts` vérifiant que les deux libellés dépendent bien de l'état `tri`.

## [1.18.3] — 2026-08-28

### Corrigé
- `/plan-table` recherche désormais aussi les noms individuels présents dans `notes` pour retrouver un membre d'un couple ou d'une famille à partir de son prénom.
- Les prénoms des membres sont affichés sous le nom du groupe sur chaque carte de table.
- `extractPrenoms` et `extractMembresComplet` sont centralisés dans `lib/membersNotes.ts` et réutilisés par les six écrans concernés.

### Tests
- Nouveau test `tests/search-member-names.test.ts` (4 scénarios) couvrant l'extraction, la recherche, l'affichage et l'absence de duplication locale.

## [1.18.2] — 2026-08-28

### Corrigé
- `lib/withjoyImport.ts` : `Cortège`, `Need_Contact` et `Mail` ne sont plus interprétés comme des rôles de staff. La même règle est synchronisée dans l'import TypeScript, le script Python et les fonctions SQL d'ajout/retrait manuel de tags.
- L'aperçu With Joy avertit lorsqu'un même nom apparaît plusieurs fois dans un groupe, sans faux positif pour les accompagnants volontairement non nommés.
- Les lignes sans aucun nom sont désormais affichées dans l'aperçu et empêchent celui-ci d'être présenté comme « propre » sans vérification.
- `supabase/migrations/0027_sync_non_role_tags_cortege_contact_mail.sql` documente l'état déjà appliqué en production; aucune réapplication Supabase n'est requise dans ce lot.

### Tests
- `tests/withjoy-import.test.ts` passe de 6 à 11 scénarios et couvre les tags non-role, les doublons, les noms vides, les groupes sans identifiant et la synchronisation des trois implémentations.

## [1.18.1] — 2026-08-28

### Corrigé
- `app/checkin/[invitationId]/page.tsx` : un déplacement de table effectué par un autre agent/admin pendant que cette fiche restait ouverte ne mettait à jour que `invitation.table_id` (via le patch temps réel) — la table affichée en haut de page (`invitationTable`, un JOIN séparé chargé une seule fois au montage) restait sur l'ancienne table jusqu'à un rechargement manuel. Le gestionnaire temps réel re-synchronise désormais `invitationTable` dès que `table_id` change réellement (nouvelle requête si non nul, remise à `null` sinon).
- `app/checkin/[invitationId]/members/page.tsx` : un renommage de l'invitation par un autre agent pendant que cette sous-page restait ouverte n'était pas reflété (le nom affiché en haut de page provient de `invitation.nom_affichage`, mais la page ne s'abonnait qu'aux changements de `invitation_guests`/`guests`, pas `invitations`). Nouvel abonnement `invitations` filtré sur cette invitation, avec le même regroupement (debounce) que le reste de la page.
- Corrige deux angles morts trouvés en vérifiant la demande explicite de Gersom : « peu importe l'info que je donne avec nom ou table ou tag changé, l'application se met à jour rapidement ». Le reste (tags, changements sur les écrans de liste) était déjà correctement propagé.

### Tests
- `tests/realtime-debounce.test.ts` complété (6 tests) : re-synchronisation de la table affichée sur `/checkin/[invitationId]`, propagation d'un renommage sur `/checkin/[invitationId]/members`.
- `npx tsc --noEmit`, `npm run test:roles` (15/15), `npm run test:floorplan` (14/14), `npm run test:members` (3/3), `npm run test:diffusion` (5/5), `npm run test:withjoy` (6/6), `npm run test:navigation` (4/4), `npm run test:realtime` (6/6) et `npm run build` tous exécutés avec succès.

## [1.18.0] — 2026-08-28

### Ajouté
- `lib/debounce.ts` : regroupe une rafale d'événements Supabase Realtime (`postgres_changes`) en un seul rechargement, appliqué aux 7 écrans qui rechargent tout leur état sur un changement temps réel (`/dashboard`, `/plan-table`, `/table/[tableId]`, `/tables/[tableId]`, `/tables/move/[invitationId]`, `/checkin/[invitationId]/members`, `/exceptions`). Un réimport CSV ou une correction en lot modifie des dizaines/centaines de lignes en quelques centaines de millisecondes ; sans regroupement, chaque écran ouvert relançait un rechargement complet par ligne modifiée — avec ~20 personnes connectées en même temps, cela multipliait les requêtes Supabase en parallèle juste après un import au lieu d'être rapide (demande explicite de Gersom). `/checkin/[invitationId]` n'est pas concerné : il applique déjà la mise à jour reçue directement sur son état, sans rechargement complet.
- `app/global-error.tsx` : filet de secours si le layout racine (`app/layout.tsx`) lui-même plante — `app/error.tsx` ne rattrape que les erreurs sous ce layout, pas une erreur dans le layout lui-même. Même stratégie de récupération (nettoyage de session puis retour à `/login`), avec son propre `<html>`/`<body>` et des styles en ligne (aucune dépendance à Tailwind, au cas où le CSS global soit la cause du plantage).

### Corrigé
- `public/sw.js` : le repli hors ligne sur une navigation pouvait toujours résoudre en `undefined` si ni `/offline` ni `/` n'étaient en cache (ex. première installation interrompue avant la fin de `cache.addAll`) — un `event.respondWith()` résolu en `undefined` fait planter la requête côté navigateur. Ajout d'un dernier filet (`Response.error()`), cohérent avec celui déjà utilisé pour les autres assets.
- `/admin/import-withjoy` : le sélecteur de fichier accepte désormais plusieurs alias MIME (`text/comma-separated-values`, `application/csv`, `application/vnd.ms-excel`, `text/plain` en plus de `.csv`/`text/csv`) — un CSV With Joy téléchargé sur iPhone puis « Enregistré dans Fichiers » peut se voir attribuer un type différent selon sa provenance (Mail, Drive...), ce qui pouvait le faire apparaître grisé dans le sélecteur « Parcourir » de Safari iOS. La lecture reste par contenu (`file.text()`), sans vérification stricte du type ensuite — demande explicite de Gersom : « le prochain import sera directement depuis le CSV With Joy, je vais le télécharger sur iPhone et ajouter le fichier directement dans l'app ». La propagation à tous les écrans ouverts passe déjà par les abonnements Supabase Realtime existants sur `invitations`/`tables`, désormais protégés par le regroupement ci-dessus.

### Tests
- Nouveau `tests/realtime-debounce.test.ts` (`npm run test:realtime`, 4 tests) : regroupement (debounce) des 7 écrans temps réel concernés, garde-fou du service worker sur le repli hors ligne, présence de `app/global-error.tsx`, alias MIME de l'import With Joy.
- `npx tsc --noEmit`, `npm run test:roles` (15/15), `npm run test:floorplan` (14/14), `npm run test:members` (3/3), `npm run test:diffusion` (5/5), `npm run test:withjoy` (6/6), `npm run test:navigation` (4/4), `npm run test:realtime` (4/4) et `npm run build` tous exécutés avec succès.

## [1.17.0] — 2026-08-27

### Ajouté
- Menu de compte unifié : nom, rôle, Historique selon `viewHistory`, Administration selon `adminPanel`, déconnexion.
- `/plan-table` regroupe recherche table/ville/vol/invité, tris, codes vol, capacité prévue et présence réelle.
- Tests de navigation/résilience pour les rôles, le scanner, le service worker et la redirection `/tables`.

### Modifié
- Les raccourcis Tables ouvrent directement `/plan-table`; `/tables` redirige côté serveur pour préserver les favoris.
- La barre inférieure admin reste compacte; Historique et Administration sont déplacés dans le menu de compte.
- Placement et présence sont affichés séparément afin de ne pas confondre confirmé/provisoire avec arrivé/partiel.

### Corrigé
- Le scanner ne tente plus de s'arrêter avant son démarrage lors de navigations rapides.
- Le service worker ignore les extensions/origines externes et garantit une réponse valide en cas d'échec réseau.

## [1.16.0] — 2026-08-27

### Ajouté
- `/checkin/[invitationId]` : sélection directe d'une ou plusieurs personnes qui ne viendront pas, en réutilisant les routes sécurisées de gestion des membres.
- Bouton message avec choix WhatsApp/SMS sur `/staff` et `/plan-table`, réservé à `admin`.
- Le nom de l'invitation dans la barre supérieure ouvre directement le renommage.

### Modifié
- Ajout, fusion d'invitations et modification des étiquettes sont réservés à `admin`. Les étiquettes restent visibles en lecture seule aux autres rôles.
- La fusion utilise désormais la capacité distincte `mergeInvitations`; `moveGuests` reste disponible à admin/directeur/placeur pour préserver les déplacements et échanges de tables.
- Les routes API d'invitations et de membres utilisent les capacités centralisées au lieu de listes de rôles locales.
- `/plan-table` affiche les invitations sans table, notamment avec le filtre provisoire.

### Sécurité et tests
- Les numéros utilisés par les liens WhatsApp/SMS sont normalisés.
- Tests de permissions mis à jour; TypeScript, rôles, membres, plan, diffusion et build vérifiés avant fusion.

## Données — 2026-08-26 (correction v6, rôles staff corrigés depuis With Joy + tables 4/8 et 5/6 réappliquées)

### Correction des tags de rôle staff + réparation d'une régression sur le lot v5
- **Régression détectée et corrigée** : le lot v5 (`family_workshop_pasted_table_v5`, ci-dessous) avait supprimé Lys Landu et Jean-Clivens Le Caous (tous deux de la table du cortège, table 1) et déplacé Brady Landu de la table 26 (confirmée à deux reprises via le Google Sheet familial, lots v3/v4) vers la table 30. Ce lot restaure les deux : Lys Landu et Jean-Clivens Le Caous de nouveau présents table 1 ; Brady Landu de nouveau table 26.
- **Tags de rôle staff corrigés à partir d'un export With Joy frais** (`guestlist_32.csv`, fourni par Gersom, corrigé à la main dans With Joy) — signalé par Gersom : « Messie Matoko n'a jamais été photographe », tags SERVICES manquants pour plusieurs personnes, tags Traiteur/Bar pas à jour. Diagnostic : ces tags de rôle (Photographe/Traiteur/Bar/DJ_Animation/SERVICES) n'ont jamais été dérivés du tableur familial (qui ne porte qu'une catégorie Staff générique) — ils venaient de l'import With Joy d'origine et étaient recopiés tels quels à chaque réimport, jamais revérifiés. Corrections appliquées (9 personnes) :
  - Messie Matoko et DJ Alain Diakuanu : tag `Photographe` retiré (n'ont jamais fait ce rôle) ;
  - Augustin, Aurelie, Moise, Noel et Veronique Nsenda : tag `Traiteur` ajouté (équipe traiteur, non taguée auparavant) ;
  - Dylan Pierrefitte : tag `SERVICES` ajouté (manquait alors qu'il a le tag de zone `Bar`) ;
  - Daeve Landu : tag `Bar` retiré, `SERVICES` conservé.
- Plusieurs téléphones/emails également rafraîchis depuis `guestlist_32.csv` (source la plus récente et la plus fiable pour les coordonnées).
- **Permutation de tables 4 ↔ 8 et 5 ↔ 6 réappliquée** : confirmée par la structure même de `guestlist_32.csv` (numéro de table encodé dans l'identifiant de groupe With Joy, indépendant des tags), donc traitée comme fiable et distincte du reste — contrairement au placement de Brady Landu dans ce même fichier (resté à l'ancienne table 30, probablement un export non resynchronisé depuis la dernière correction), qui n'a pas été repris. 25 personnes concernées ; capacités après permutation : table 4 = 10/10, table 5 = 10/10, table 6 = 9/10, table 8 = 8/10.
- Les tables/noms des autres invitations restent pilotés par le Google Sheet familial (lot v4) — `guestlist_32.csv` n'a servi que pour les coordonnées, les tags de rôle, et la permutation 4/8 · 5/6 ci-dessus, conformément à la règle « With Joy = contacts et rôles, plus les tables en général ».
- Vérification : comparaison automatisée champ par champ — correspondance parfaite après chaque étape (correction des rôles : 243/243 lignes ; permutation de tables : exactement les 25 lignes attendues modifiées, rien d'autre). Sauvegardes `import_backups` confirmées à chaque étape.
- Aucun changement de code applicatif — réimport de données uniquement.

## Données — 2026-08-25 (correction v5, atelier famille — tableau transmis)

### Mise à jour ciblée du plan de table
- Tableau transmis directement par Gersom appliqué à l'événement « Mariage Nelly & Gersom », la colonne `Table` restant la source de vérité du placement conformément à `docs/DATA_CHANGE_INSTRUCTIONS.md`.
- Avant : 243 invitations, 382 personnes prévues, 0 arrivée, 11 invitations sans table. Après : **241 invitations, 380 personnes prévues, 0 arrivée, 11 invitations sans table**.
- Permutations appliquées : tables **4 ↔ 8** et **5 ↔ 6**. Les capacités indiquées par le tableau sont respectées (10/10, 8/10, 10/10 et 9/10 respectivement).
- **Brady Landu** figurait encore deux fois dans le tableau (table 26 et table 30) : conformément aux corrections v2/v3 déjà documentées, seule la ligne Staff de la table 30 est conservée ; la ligne table 26 est ignorée.
- **Jean-Clivens Le Caous** et **Lys Landu**, absents du nouveau tableau, ont été retirés. Aucun check-in ni membre détaillé ne leur était rattaché.
- Les **11 invitations sans table ont été conservées intégralement**, car le tableau transmis ne contient que les tables numérotées et leur omission ne doit pas supprimer le staff accueilli via le QR `STAFF`.
- Trois écarts déjà présents entre `Nb personnes` et la liste textuelle des noms ont été laissés tels quels, le nombre étant la valeur opérationnelle : Famille Pello (2 pour 4 noms listés), Famille Mpiassa (3 pour 4), Famille Culumbu table 36 (3 pour 4).
- Écriture transactionnelle avec contrôle de concurrence, sauvegarde préalable `import_backups` (`bb2c2552-750a-4bc4-b170-7576e98b09bd`) et journal d'audit `family_workshop_pasted_table_v5`. Vérification après écriture : 241 invitations / 380 personnes / 0 arrivée / 11 sans table ; Brady uniquement table 30.
- Aucun changement de code applicatif ni de schéma — données uniquement, version inchangée.

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
