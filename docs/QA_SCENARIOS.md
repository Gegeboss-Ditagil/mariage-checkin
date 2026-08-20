# Scénarios QA obligatoires

Exécuter avant chaque push touchant aux rôles, à la navigation, aux formulaires ou aux données.

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

Ne jamais effectuer de test d'écriture sur les vraies données sans mode test ou autorisation explicite.
