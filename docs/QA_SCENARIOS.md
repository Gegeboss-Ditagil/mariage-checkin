# Scénarios QA obligatoires

**Version documentaire : 1.2.2**  
**Dernière mise à jour : 2026-08-22**

Exécuter avant chaque push touchant aux rôles, à la navigation, aux formulaires, aux sessions, à la PWA ou aux données.

## Pour chacun des cinq rôles

1. Connexion valide, invalide et compte désactivé.
2. Destination après connexion et bouton Continuer.
3. Navigation du bas et tentative d'URL directe vers une page interdite.
4. Recherche par nom, table, téléphone et email.
5. Scan QR reconnu, nom de ville et QR inconnu.
6. Consultation d'une table : noms, compteurs, statuts et débordements visibles.
7. Check-in, correction et annulation selon les permissions.
8. Gestion des membres et marquage « ne viendra pas » selon les permissions.
9. Affectation puis réorganisation d'un débordement selon les permissions.
10. Déplacement d'une invitation selon les permissions.
11. Dashboard, historique, exceptions et export selon les permissions.
12. Écran Staff : accès réservé à admin, directeur de festin et visibilité (agent placeur et agent scan n'y accèdent pas, même par URL directe) ; check-in selon permission ; badge Sans table ; téléphone absent/présent ; staff affiché par personne (jamais par foyer) quand un seul membre du foyer porte le tag de rôle.
13. QR `STAFF` en casse variée : redirection vers `/staff` pour admin/directeur uniquement ; visibilité ne doit jamais accéder à la caméra.

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
