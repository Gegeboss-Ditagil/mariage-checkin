# Scénarios QA obligatoires

**Version documentaire : 1.8.0**
**Dernière mise à jour : 2026-08-23**

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
8ter. Étiquettes depuis `/checkin/[invitationId]` (agent scan inclus, visibilité exclu même par URL directe) : ajouter/retirer un tag via un raccourci et via le champ libre ; ajouter `Côté_Gege` puis `Côté_Nelly` retire bien le premier (mutuellement exclusifs) et met à jour `cote` ; ajouter un tag de rôle (`Photographe`, `Prestataire`, `DJ_Animation`, `SERVICES`, ou tout tag libre non reconnu) place l'invitation en `category = 'Staff'` et la fait apparaître sur `/staff` ; retirer ce tag alors qu'aucun autre tag de rôle ne reste repasse `category` à vide et la fait disparaître de `/staff` ; retirer un tag de rôle alors qu'un AUTRE tag de rôle reste présent laisse `category = 'Staff'` inchangé ; ajouter/retirer `notable` bascule uniquement le badge « Sans table » sans toucher `category` ; ajouter un tag déjà présent ou retirer un tag absent ne fait rien (idempotent, pas de doublon dans l'affichage).
9. Affectation puis réorganisation d'un débordement selon les permissions.
10. Déplacement d'une invitation selon les permissions.
10bis. Transfert et échange en lot sur `/table/[tableId]` et `/tables/[tableId]` : sélection multiple visible seulement selon permission ; transfert de N invitations vers une seule table ; échange A↔B avec des tailles de groupe différentes (ex. 2 contre 4) ; une invitation déjà déplacée entre-temps par quelqu'un d'autre est ignorée sans faire échouer le reste du lot ; `agent_checkin` ne doit atteindre ni `/tables/move-multiple` ni `/api/move-invitations`/`/api/swap-invitations`, y compris par URL directe.
11. Dashboard, historique, exceptions et export selon les permissions.
12. Écran Staff : accessible à admin, directeur, placeur et agent scan (consultation + check-in), ainsi qu'à visibilité (consultation seule, bouton de check-in absent); admin/directeur/visibilité voient les onglets « Sans table » et « Avec table », avec « Sans table » sélectionné par défaut; placeur/agent scan ne voient aucun onglet et seulement les personnes `notable` sans table; vérifier directement `GET /api/staff` pour confirmer que les lignes avec table ne sont pas envoyées à ces deux rôles; badge Sans table; numéro de table dans l'onglet Avec table; recherche et téléphone absent/présent; staff affiché par personne.
13. QR `STAFF` en casse variée : redirection vers `/staff` pour admin/directeur/placeur/agent scan; visibilité ne doit jamais accéder à la caméra. Tester aussi un scan immédiatement après l'arrivée sur `/scan`, badge déjà présenté : aucun refus ne doit apparaître avant le chargement du rôle.
14. Première création des membres : partir d'une invitation prévue à 2, retirer une ligne du brouillon avant l'enregistrement et vérifier le passage à 1 prévu avec statut recalculé; ajouter une ligne au brouillon ne doit jamais augmenter implicitement `nombre_prevu`; un second enregistrement concurrent doit recevoir `already_initialized`.

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

- Deux téléphones ouverts sur la même invitation.
- Modification distante pendant qu'un compteur local est en cours.
- Double validation simultanée.
- Perte de réseau avant confirmation et pendant une lecture.
- Rafraîchissement PWA/service worker sur une URL devenue interdite.

## Commandes minimales

```bash
npm run test:roles
npx tsc --noEmit
npm run build
```

## Contrôle de version avant merge

- Vérifier `package.json`.
- Vérifier `CHANGELOG.md`.
- Vérifier que tous les documents modifiés affichent la version courante.
- La PR doit indiquer `Version: X.Y.Z → A.B.C` ou `Version inchangée: X.Y.Z`.

Ne jamais effectuer de test d'écriture sur les vraies données sans mode test ou autorisation explicite.
