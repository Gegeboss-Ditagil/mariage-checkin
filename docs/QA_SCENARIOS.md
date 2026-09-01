# Scénarios QA obligatoires

**Version documentaire : 1.29.1**
**Dernière mise à jour : 2026-08-30**

Exécuter avant chaque push touchant aux rôles, à la navigation, aux formulaires, aux sessions, à la PWA ou aux données. Voir `docs/QE_QA_PROCESS.md` pour la méthode (QE avant merge, QA quand un bug est signalé) — cette liste est le contenu à vérifier, QE_QA_PROCESS.md est la façon de le faire.

## Pour chacun des cinq rôles

1. Connexion valide, invalide et compte désactivé.
2. Destination après connexion et bouton Continuer.
3. Navigation du bas et tentative d'URL directe vers une page interdite.
4. Recherche par nom, table, téléphone et email.
5. Scan QR reconnu, nom de ville et QR inconnu.
6. Consultation d'une table : noms, compteurs, statuts et débordements visibles.
7. Check-in, correction et annulation selon les permissions.
8. Gestion des membres et marquage « ne viendra pas » selon les permissions.
8bis. Renommer une invitation depuis `/checkin/[invitationId]` selon les permissions (agent scan inclus) ; fusionner deux invitations selon les permissions (agent scan exclu, avertissement affiché — jamais bloqué — quand les deux sont `category = 'Staff'`) ; vérifier après fusion que checkins, débordements et membres détaillés de la source apparaissent bien sur la cible (rien perdu), pas seulement les compteurs.
8ter. Étiquettes depuis `/checkin/[invitationId]` (admin, directeur et placeur uniquement ; agent scan et visibilité exclus) : vérifier que la section est absente pour les rôles exclus et que les API d'ajout/retrait refusent aussi leurs requêtes directes ; pour les rôles autorisés, ajouter/retirer un tag via un raccourci et via le champ libre ; ajouter `Côté_Gege` puis `Côté_Nelly` retire bien le premier (mutuellement exclusifs) et met à jour `cote` ; ajouter un tag de rôle (`Photographe`, `Prestataire`, `DJ_Animation`, `SERVICES`, ou tout tag libre non reconnu) place l'invitation en `category = 'Staff'` et la fait apparaître sur `/staff` ; retirer ce tag alors qu'aucun autre tag de rôle ne reste repasse `category` à vide et la fait disparaître de `/staff` ; retirer un tag de rôle alors qu'un AUTRE tag de rôle reste présent laisse `category = 'Staff'` inchangé ; ajouter/retirer `notable` bascule uniquement le badge « Sans table » sans toucher `category` ; ajouter un tag déjà présent ou retirer un tag absent ne fait rien (idempotent, pas de doublon dans l'affichage).
9. Affectation puis réorganisation d'un débordement selon les permissions.
10. Déplacement d'une invitation selon les permissions.
10bis. Transfert et échange en lot sur `/table/[tableId]` et `/tables/[tableId]` : sélection multiple visible seulement selon permission ; transfert de N invitations vers une seule table ; échange A↔B avec des tailles de groupe différentes (ex. 2 contre 4) ; une invitation déjà déplacée entre-temps par quelqu'un d'autre est ignorée sans faire échouer le reste du lot ; `agent_checkin` ne doit atteindre ni `/tables/move-multiple` ni `/api/move-invitations`/`/api/swap-invitations`, y compris par URL directe.
11. Dashboard, historique, exceptions et export selon les permissions. Dans chaque liste détaillée du dashboard, vérifier la répartition côté Nelly/Gégé et la bonne unité selon la vue : arrivés, restants, supplémentaires ou prévus.
12. Écran Staff : accessible à admin, directeur, placeur et agent scan (consultation + check-in), ainsi qu'à visibilité (consultation seule, bouton de check-in absent); admin/directeur/visibilité voient les onglets « Sans table » et « Avec table », avec « Sans table » sélectionné par défaut; placeur/agent scan ne voient aucun onglet et seulement les personnes `notable` sans table; vérifier directement `GET /api/staff` pour confirmer que les lignes avec table ne sont pas envoyées à ces deux rôles; badge Sans table; numéro de table dans l'onglet Avec table; recherche et téléphone absent/présent; staff affiché par personne.
13. QR `STAFF` en casse variée : redirection vers `/staff` pour admin/directeur/placeur/agent scan; visibilité ne doit jamais accéder à la caméra. Tester aussi un scan immédiatement après l'arrivée sur `/scan`, badge déjà présenté : aucun refus ne doit apparaître avant le chargement du rôle.
14. Première création des membres : partir d'une invitation prévue à 2, retirer une ligne du brouillon avant l'enregistrement et vérifier le passage à 1 prévu avec statut recalculé; ajouter une ligne au brouillon ne doit jamais augmenter implicitement `nombre_prevu`; un second enregistrement concurrent doit recevoir `already_initialized`.
15. Plan de salle interactif sur `/plan-table` (tous rôles ayant `viewTables`, donc les cinq) : le bouton « 🗺️ Voir le plan de salle » est replié par défaut; l'ouvrir affiche les 41 tables numérotées (1 à 40 plus la réserve, 41, qui a désormais un emplacement), aucune n'est superposée à une autre ni à un libellé de pièce; appuyer sur une table du plan la surligne en vert et fait apparaître une carte « Table sélectionnée » juste en dessous avec la bonne liste d'invités; le bouton 📍 sur une carte de la liste plus bas (y compris la carte de la réserve) sélectionne la même table, ouvre le plan s'il était fermé et y fait défiler la page; cliquer le reste d'une carte (hors bouton 📍) continue de naviguer normalement vers `/tables/[tableId]`, sans régression; la flèche retour du haut ramène au bon écran selon le rôle (`/scan` ou `/tables`), comme avant cette fonctionnalité.
16. Zoom du plan de salle sur `/plan-table` : pincer à deux doigts agrandit le plan (jusqu'à ×3) sans zoomer le reste de la page; relâcher le pincement au-dessus d'une table ne la sélectionne jamais par accident; glisser à un doigt une fois zoomé déplace le plan sans jamais laisser un bord vide apparaître dans le cadre; les boutons +/− (et ↺ une fois zoomé) fonctionnent au clic/tactile pour les appareils sans pincement; refermer puis rouvrir le plan réinitialise le zoom à 100 %; un double-tap/double-clic réinitialise aussi le zoom.
17. Zones staff cliquables sur le plan de `/plan-table` (Cuisine, Bar, DJ et animation, Prestataires & staff) : cliquer une zone en surbrillance affiche le personnel de catégorie Staff portant le tag correspondant (Traiteur, Bar, DJ_Animation, Photographe) juste en dessous du plan, avec statut de table et bouton d'appel; sélectionner une zone efface la table sélectionnée (et inversement), un seul panneau s'affiche à la fois; une zone sans personnel rattaché affiche un message clair plutôt qu'une liste vide silencieuse; les zones sans tag (Zone enfants, Piste de danse, Stage band & chanteurs, couloirs, buffets…) restent de simples repères visuels, non cliquables.
18. Diffusion des invitations : `/admin/diffusion` inaccessible aux quatre rôles non-admin; import `.xlsx` et `.csv` sans appel API; association automatique et manuelle des colonnes; `T010` produit exactement `https://libalz.my.canva.site/vol-t010`; un code absent/invalide bloque WhatsApp et email; aperçu personnalisé; aucun envoi automatique; statut modifiable puis présent dans l'Excel réexporté; rechargement de page ne restaure aucune coordonnée.

## Session, déploiement et PWA

- Une session valide reste utilisable avant 12 h.
- Une session expirée est renvoyée vers `/login` et ses cookies auxiliaires sont supprimés.
- Après un nouveau déploiement, une session issue de l'ancien déploiement est invalidée à la prochaine requête protégée.
- Une erreur client de version/chunk doit afficher la récupération puis retourner au login, pas une page blanche durable.
- Le service worker ne doit jamais servir `/_next/*` depuis un ancien cache.
- Vérifier qu'une PWA installée sur iPhone/Android récupère la nouvelle version après redéploiement.

## Capacité (depuis v1.1.0)

- 41 tables présentes : 1-40 normales, 41 réserve.
- Capacité officielle affichée : 400.
- Capacité absolue avec réserve : 410.
- `/plan-table` : une invitation `table_id = NULL` (staff `notable` sans table) ne doit jamais être comptée en excédentaire/réserve — seule une invitation réellement placée en table 41 compte comme excédentaire.
- `/dashboard` : la jauge « Remplissage de la salle » marque visuellement le seuil des 400 places officielles dans sa graduation sur 410.
- Les tables 38-40 ne doivent plus être marquées réserve.

## Concurrence et réseau

- Import With Joy : aperçu sans écriture; admin uniquement; RSVP déclinés exclus; staff individualisé; `Groomsman`/`Bridesmaid` non-staff; `notable` et `Needs_Table_*` sans table; `Txxx`/`Fxxx` reconnus; saturation bloquée; deuxième import concurrent refusé; modes live/closed refusés; sauvegarde privée et audit créés dans la même transaction.

- Deux téléphones ouverts sur la même invitation.
- Modification distante pendant qu'un compteur local est en cours.
- Double validation simultanée.
- Perte de réseau avant confirmation et pendant une lecture.
- Rafraîchissement PWA/service worker sur une URL devenue interdite.

## Navigation, compte et écrans — v1.17.0

- Pour chaque rôle, ouvrir le menu du compte au clavier et au toucher : nom et rôle visibles; Historique selon `viewHistory`; Administration selon `adminPanel`; déconnexion toujours disponible.
- Confirmer qu'Historique et Administration ne sont plus dupliqués dans la barre inférieure et que le raccourci Plan ouvre `/plan-table`.
- Ouvrir un ancien favori `/tables` et confirmer la redirection vers `/plan-table`; les routes de détail et de déplacement restent accessibles uniquement selon leurs capacités.
- Sur `/plan-table`, vérifier recherche table/ville/vol/invité, tri numéro/places libres, codes Vol-F/Vol-T, places prévues, arrivées, placement provisoire/confirmé et présence non arrivé/partiel/arrivé/excédent.
- Enchaîner rapidement Scan → Plan → détail → retour → Scan au moins dix fois : aucune page blanche, aucune caméra laissée active, aucune promesse rejetée dans la console.
- Refuser la caméra, tester sans caméra, puis réessayer; répéter avec une webcam d'ordinateur si disponible.
- Tester 390×844, 768×1024 et 1440×900 dans Chrome/Edge; compléter sur Safari iOS/iPadOS et Chrome Android avant le jour J. Aucun débordement horizontal ni cible tactile difficile à atteindre.
- Passer hors ligne puis en ligne, mettre la PWA en arrière-plan puis la rouvrir : les données se réactualisent et le service worker ne tente jamais de mettre en cache une extension, une API ou une origine externe.

## Charge à ~20 personnes et import CSV depuis iPhone — v1.18.0

- Réimporter un CSV With Joy volumineux (ou corriger plusieurs invitations en lot) pendant que `/dashboard`, `/plan-table`, `/table/[tableId]`, `/tables/[tableId]`, `/checkin/[invitationId]/members` et `/exceptions` sont ouverts sur plusieurs téléphones : chaque écran doit se mettre à jour, sans rafale de rechargements ni ralentissement notable — un seul rechargement groupé par écran juste après la fin de la rafale d'écriture, pas un par ligne modifiée.
- Depuis `/admin/import-withjoy` sur iPhone, télécharger un export CSV dans Mail/Drive puis « Enregistrer dans Fichiers », et vérifier qu'il apparaît bien sélectionnable (non grisé) dans le sélecteur « Parcourir » de Safari.
- Simuler un crash dans le layout racine (ex. lever une exception dans un composant monté par `app/layout.tsx`) : `app/global-error.tsx` doit s'afficher et renvoyer vers `/login` après nettoyage de session, jamais une page blanche.
- (v1.18.1) Ouvrir `/checkin/[invitationId]` sur un téléphone, puis déplacer cette invitation vers une autre table depuis un second téléphone : le numéro/libellé de table affiché sur le premier doit se mettre à jour sans rechargement manuel. Répéter avec un renommage pendant que `/checkin/[invitationId]/members` est ouvert.

## Commandes minimales

## Placement RSVP et plan de table — v1.19.0

- `placement_status` suit désormais le RSVP (« Confirmée » seulement si chaque membre du groupe a répondu « Oui... », sinon « Provisoire ») et non plus le fait que la table vienne d'un tag CSV explicite ou de l'algorithme — vérifier qu'un groupe avec un tag `T0xx`/`F0xx` mais RSVP « Peut-être » (ou sans réponse) s'affiche bien « Provisoire ».
- Sur `/plan-table`, taper les tuiles « X côté Nelly »/« X côté Gégé » filtre les invitations affichées dans chaque table (sans masquer les tables elles-mêmes) — retaper la même tuile revient à « toutes ». Idem pour les tuiles « places confirmées »/« places provisoires », qui remplacent l'ancienne rangée de boutons dédiée.
- Vérifier qu'une seule barre de progression (capacité/prévu/présence) s'affiche par table et en haut de page, avec un trait pour le nombre prévu et un remplissage qui passe au rouge dès que les arrivées dépassent le prévu.
- `/checkin/[invitationId]` : libérer une place dans « Qui ne vient pas dans ce groupe ? » doit proposer un bouton « ↩️ Annuler » qui remet la personne exactement (prénom + nom) ; « Cet invité ne viendra pas » doit se cacher pour un groupe dont le détail des membres est connu, mais rester visible pour une invitation solo et pour annuler un marquage déjà posé.

## Thème clair/sombre — v1.20.0

- Menu de compte (icône en haut à droite) : le sélecteur « ☀ Clair / ● Sombre » change l'apparence immédiatement, sans rechargement, et l'état actif (fond plein) suit bien le thème réellement affiché.
- Recharger la page (ou fermer/rouvrir l'appli) après avoir choisi « Sombre » : pas de flash clair avant le passage au thème sombre (le script bloquant de `app/layout.tsx` doit poser `data-theme` avant le premier rendu).
- Le choix persiste après déconnexion/reconnexion sur le même appareil (stocké en local), mais ne doit PAS suivre le mode sombre/clair du système d'exploitation tout seul.
- Sur `/checkin/[invitationId]` en thème sombre : « Gérer les membres du groupe » et « Cet invité ne viendra pas » doivent se lire comme de vrais boutons (fond, bordure) et non comme du texte souligné — vérifier aussi en thème clair, où ils ont reçu le même traitement.
- Vérifier la lisibilité (contraste texte/fond) du thème sombre sur : la carte d'information (table/prévu/arrivées), les étiquettes, le formulaire de renommage, la notice de synchronisation. Les autres pages (`/dashboard`, `/plan-table`, `/search`, `/tables`, `/staff`, `/admin/*`) n'ont reçu que l'habillage sombre générique de `.card`/`.btn-primary`/`.btn-secondary` — pas de vérification écran par écran à ce jour, à signaler si quelque chose choque.

```bash
npm run test:roles
npm run test:floorplan
npm run test:members
npm run test:diffusion
npm run test:withjoy
npm run test:navigation
npm run test:realtime
npm run test:searchnames
npm run test:sortlabel
npm run test:arrival
npm run test:listecote
npm run test:theme
npx tsc --noEmit
npm run build
```

## Arrivée par personne sur le check-in de groupe — v1.21.0

- Ouvrir `/checkin/[invitationId]` pour un groupe (`nombre_prevu > 1`) : la liste des membres nommés apparaît immédiatement (pas de compteur +/-, pas de bouton « Confirmer l'arrivée » en bas), même si c'est la toute première ouverture de cette fiche (matérialisation automatique depuis « Membres: ... »).
- Taper ✓ sur une personne : elle passe en vert, le total « Actuellement enregistrées » de la carte au-dessus augmente de 1 immédiatement (pas de rechargement). Retaper ✓ annule (retour à l'état neutre, le total redescend de 1).
- Taper ✕ sur une personne : elle se grise (nom barré), `nombre_prevu` diminue de 1 (place libérée), la personne reste visible dans la liste — jamais supprimée. Retaper ✕ annule (place restaurée).
- Taper ✓ directement sur une personne déjà en ✕ (sans repasser par le neutre) : les deux totaux bougent en même temps (place restaurée ET comptée arrivée).
- « Cet invité ne viendra pas » (tout le groupe) ne doit plus apparaître dès que `nombre_prevu > 1`, sauf s'il était déjà marqué avant (moyen de l'annuler).
- « + Invité supplémentaire (non prévu) » : déclenche le flux d'excédent/débordement existant, inchangé (proposition de table de réserve si besoin).
- Depuis « Gérer les membres du groupe », supprimer définitivement une personne déjà marquée ✕ ne doit PAS faire baisser `nombre_prevu` une seconde fois ; supprimer une personne marquée ✓ doit aussi faire baisser `nombre_arrive`.
- Invitation solo (`nombre_prevu <= 1`) : aucun changement, le compteur +/- et « Cet invité ne viendra pas » se comportent exactement comme avant v1.21.0.

## Thème « Atrium » (clair) / « Maison » (sombre) — v1.22.0

Remplace entièrement le scénario « Thème clair/sombre — v1.20.0 » ci-dessus (Glass Sombre n'existe plus) : le revérifier avec les nouveaux repères ci-dessous plutôt que l'ancien.

- Première connexion sur un compte qui n'a jamais choisi de thème (`localStorage` sans `checkin-theme-chosen`) : après l'écran « Bienvenue, {prénom} ! », atterrit sur l'écran de choix de thème (Sombre/Clair/Automatique), pas directement sur `/scan` ou `/dashboard`. Choisir une option puis « Continuer vers le scan » atterrit bien sur `landingPathForRole(role)` (`/scan` pour agent_checkin/placeur/admin, `/dashboard` pour directeur/visibilite) — jamais une route en dur.
- Une deuxième connexion (même appareil, drapeau déjà posé) saute directement l'écran de choix.
- Menu de compte : le segmented control à 3 positions (Sombre/Clair/Auto) change l'apparence immédiatement, sans rechargement ; l'option active est visuellement nette (fond `--accent`).
- Choisir « Automatique », puis changer le réglage clair/sombre du système (iPhone : Réglages → Luminosité et affichage) sans rouvrir l'app : le thème doit basculer tout seul, en direct.
- Recharger la page après avoir choisi « Sombre » : pas de flash clair avant le passage au thème sombre (script bloquant de `app/layout.tsx`).
- Page de connexion (`/login`) : suit maintenant elle aussi Atrium/Maison (avant v1.22.0 elle restait toujours « Verre Doré ») — vérifier le halo discret derrière le sceau et le ciel étoilé uniquement en Maison, la carte neutre en Atrium.
- Sur `/checkin/[invitationId]` : « Gérer les membres du groupe », « Cet invité ne viendra pas », les boutons ✓/✕ par personne restent de vrais boutons cliquables dans les deux modes (hérité de v1.20.0, à revérifier avec les nouveaux tokens).
- Barre de navigation basse : bouton Scan central surélevé, pas un onglet comme les autres ; le rôle `visibilite` (pas de capacité scan) garde une barre plate à 3 onglets sans bouton central.
- Bouton de contact WhatsApp (fiches invités avec téléphone, `/staff`, `/search`) : pastille verte pleine (pas teintée) avec icône blanche, identique dans les deux thèmes.
- Parcourir au moins `/dashboard`, `/plan-table`, `/search`, `/tables`, `/staff`, `/admin` dans les deux modes : pas de texte illisible (contraste), pas de couleur de l'ancienne charte (or/parchemin/nuit) qui réapparaît.

## Édition directe des membres — v1.23.0

- Ouvrir une fiche de groupe qui n'a jamais été ouverte depuis le déploiement (matérialisation depuis les notes à faire) : le message « Chargement des membres… » doit rester affiché jusqu'à ce que la vraie liste apparaisse — jamais un flash du vieux compteur `-/0/+` avant.
- Rôle avec `manageMembers` : taper le nom d'une personne dans « Qui est arrivé ? » fait apparaître les champs prénom/nom en édition ; « Enregistrer » met à jour le nom affiché immédiatement.
- Rôle avec `manageMembers` : bouton « + » sous la liste → mini-formulaire prénom/nom → « Ajouter » fait apparaître la personne dans la liste avec ses boutons ✓/✕.
- Rôle sans `manageMembers` (ex. agent scan) : ni le nom ni le bouton « + » ne sont cliquables/visibles pour éditer — la liste reste consultable.

## Invité imprévu nommé — v1.24.0

- Groupe déjà complet (`nombre_arrive = nombre_prevu`) : taper « + Invité supplémentaire (non prévu) », remplir un nom, « Ajouter, déjà arrivé » → la personne apparaît dans « Qui est arrivé ? » (✓ déjà coché), `nombre_prevu` ne bouge pas, et l'écran d'assignation à une table de réserve s'ouvre (comme avant, pour le +1 anonyme).
- Groupe pas encore complet : même bouton, la personne apparaît dans la liste sans ouvrir l'assignation de table (pas de dépassement).
- Vérifier `/history` : l'entrée apparaît comme une arrivée normale (delta +1, même format que les autres check-in).

## Déplacement d'une personne seule + bouton central par rôle — v1.25.0

- Rôle avec `moveGuests` (admin/directeur/placeur) : dans « Qui est arrivé ? » d'un groupe de 2+, bouton ⇄ sur une personne → choisir une table différente de la table actuelle → confirmer → redirigé vers une **nouvelle fiche à une seule personne** à la table choisie ; la fiche d'origine ne contient plus que les autres membres, `nombre_prevu` de la source diminue de 1 (sauf si la personne était déjà « ne viendra pas »).
- Rôle sans `moveGuests` (ex. agent scan) : bouton ⇄ absent de la liste.
- Personne qui était `arrive` avant le déplacement : reste `arrive` sur la nouvelle fiche (jamais réinitialisée à « attendu »), et `nombre_arrive` de la source diminue de 1.
- Après déplacement, utiliser « Fusionner avec un autre groupe » depuis la nouvelle fiche pour la regrouper avec une invitation déjà présente à la table cible — vérifier que la fusion fonctionne comme avant.
- Connexion en tant que directeur/placeur (ex. Remy, Tuzola) : le bouton doré central de la barre de navigation ouvre `/dashboard`, pas `/scan` ; Scan reste accessible en onglet latéral.
- Connexion avec un autre rôle (agent_checkin, visibilité, admin) : le bouton central reste `/scan` (ou comportement inchangé pour visibilité/admin) comme avant.

## Barre de navigation « verre liquide » + paysage + historique admin-only — v1.26.0

- Sur les 9 écrans à barre de navigation (`/dashboard`, `/staff`, `/scan`, `/search`, `/plan-table`, `/exceptions`, `/placement`, `/history`, `/admin`), en orientation portrait : la barre est une pilule flottante arrondie légèrement surélevée du bord bas, icônes bien visibles, libellés inactifs lisibles sur fond sombre.
- Tourner le téléphone en paysage sur l'un de ces écrans : la barre bascule en bande verticale fixée au bord droit de l'écran (au lieu de rester en bas) ; le contenu de la page reste défilable de haut en bas indépendamment de la barre ; tous les boutons restent cliquables et l'état actif (icône en surbrillance) reste correct.
- Sur iPad en orientation paysage : même bascule en bande verticale (pas de logique séparée par taille d'écran — uniquement l'orientation).
- Revenir en portrait : la barre redevient une pilule horizontale en bas, sans état visuel resté « coincé » de la bascule précédente.
- `/scan` : une bande compacte affiche « X / Y arrivés » et une jauge de remplissage juste au-dessus de la barre de navigation ; taper dessus ouvre `/dashboard`. Les chiffres suivent les arrivées en temps réel (comme `/dashboard`), sans recharger la page.
- Connexion avec un rôle autre qu'admin (directeur, placeur, agent scan) : `/history` n'apparaît plus dans le menu du compte, et une navigation directe par URL vers `/history` renvoie vers l'écran par défaut du rôle au lieu d'afficher la page.
- Connexion en tant qu'admin : `/history` reste accessible normalement (menu du compte et URL directe).

## Invité surprise avec approbation SMS/WhatsApp à distance — v1.27.0

- Bouton « 📷 Invité surprise (non prévu) » visible sur `/scan` uniquement pour admin/directeur/placeur — absent pour agent scan et visibilité.
- Rôle sans `guestApproval` (agent scan) : `POST /api/guest-approvals` en appel direct (sans passer par le bouton) → rejeté (401), pas seulement caché côté interface. Idem pour `/api/guest-approvals/[id]/assign-table`.
- Flux complet : photo → côté (Nelly/Gégé) → nom/nombre → « Envoyer la demande » → SMS **et** WhatsApp reçus par l'approbateur configuré (`guest_approvers`) → clic sur le lien `/approve/[token]` → photo visible, sans connexion → Approuver → statut « Approuvé » visible dans `/approbations` (sondage, quelques secondes).
- **Décider par réponse WhatsApp** : répondre « Oui »/« O »/« Y » (approuve) ou « Non »/« N » (refuse) au message WhatsApp reçu, sans cliquer le lien → même effet que le clic web (statut mis à jour, `decided_via = 'whatsapp'` visible dans `/approbations`) ; réponse en TwiML confirmant la décision directement dans la conversation. Une réponse illisible (ni Oui ni Non) → l'app redemande de répondre OUI ou NON, sans planter. Une réponse WhatsApp pour un numéro sans demande en attente → message clair, pas d'erreur technique.
- Un deuxième clic/une deuxième réponse (web ou WhatsApp, dans n'importe quel ordre) après décision → « déjà traité », jamais une erreur technique brute (`409` côté web).
- Refus (web ou WhatsApp) → statut « Refusé », aucun bouton « Assigner une table », visible dans `/approbations`.
- Après approbation (quel que soit le canal de décision), l'approbateur reçoit un SMS de confirmation : « il vous reste maintenant N places » en réserve — vérifier que N correspond au calcul déjà utilisé par `/dashboard`/`/plan-table` (places de réserve libres maintenant).
- « Assigner une table » depuis `/approbations` (demande approuvée) → sélection d'une table (`TablePicker`, capacités en direct) → confirme → nouvelle invitation créée, visible sur sa fiche `/checkin/[invitationId]` (`nombre_arrive = 0`, à confirmer manuellement comme n'importe quel invité) ; un deuxième essai d'assignation sur la même demande → refusé (déjà assignée).
- Rémy Landu et Tuzola (`festin_directors`) reçoivent tous deux le SMS de rapport après cette assignation — nom de l'approbateur, table, places de réserve restantes.
- Vérifier qu'aucun MMS/média n'est tenté sur aucun des deux canaux (numéro Twilio français pour le SMS ; Content Template obligatoire pour le WhatsApp) — uniquement du texte avec le lien.
- Vérifier qu'une requête webhook WhatsApp sans signature Twilio valide (`X-Twilio-Signature`) est rejetée (403), jamais traitée comme une vraie décision.
- Vérifier que `SUPABASE_SERVICE_ROLE_KEY` n'apparaît jamais côté client sur `/approve/[token]` (page publique).
- Sans les variables d'environnement Twilio SMS configurées sur Vercel : la demande est quand même créée (photo/infos conservées), l'agent voit un message clair indiquant que le SMS n'est pas parti et doit prévenir l'approbateur autrement.
- Sans `TWILIO_WHATSAPP_NUMBER`/`TWILIO_WHATSAPP_CONTENT_SID_REQUEST` configurés : le canal WhatsApp est silencieusement absent, le SMS continue de fonctionner seul (pas d'erreur visible pour l'agent).

## Contrôle de version avant merge

- Vérifier `package.json`.
- Vérifier `CHANGELOG.md`.
- Vérifier que tous les documents modifiés affichent la version courante.
- La PR doit indiquer `Version: X.Y.Z → A.B.C` ou `Version inchangée: X.Y.Z`.

Ne jamais effectuer de test d'écriture sur les vraies données sans mode test ou autorisation explicite.
