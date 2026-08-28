# Scénarios QA obligatoires

**Version documentaire : 1.18.2**
**Dernière mise à jour : 2026-08-28**

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

```bash
npm run test:roles
npm run test:floorplan
npm run test:members
npm run test:diffusion
npm run test:withjoy
npm run test:navigation
npm run test:realtime
npx tsc --noEmit
npm run build
```

## Contrôle de version avant merge

- Vérifier `package.json`.
- Vérifier `CHANGELOG.md`.
- Vérifier que tous les documents modifiés affichent la version courante.
- La PR doit indiquer `Version: X.Y.Z → A.B.C` ou `Version inchangée: X.Y.Z`.

Ne jamais effectuer de test d'écriture sur les vraies données sans mode test ou autorisation explicite.
