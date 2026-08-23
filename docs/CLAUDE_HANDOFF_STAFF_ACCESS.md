# Transmission Claude — accès sécurisé à `/staff`

**Version documentaire : 1.13.0**
**Dernière mise à jour : 2026-08-23**

Ce fichier explique la logique d'accès Staff à conserver lors des prochains changements. Il ne contient volontairement aucun code PIN ni secret.

## Source de vérité

Toutes les décisions de rôle passent par `lib/permissions.ts` :

- `viewStaff` autorise l'ouverture de `/staff` et l'appel à `GET /api/staff`;
- `viewAllStaff` autorise la vue d'ensemble du personnel, avec ou sans table;
- `checkin` autorise l'ouverture de la fiche de check-in;
- `scan` autorise la caméra et le QR littéral `STAFF`.

Ne jamais recréer une liste telle que `role === 'admin' || role === ...` dans une page ou une API. Utiliser `hasCapability(role, capability)` afin qu'un changement de rôle soit fait une seule fois et couvert par les tests.

## Matrice à préserver

| Rôle | `viewStaff` | `viewAllStaff` | `checkin` | Résultat dans `/staff` |
|---|---:|---:|---:|---|
| Admin | Oui | Oui | Oui | Onglets Sans table / Avec table, lignes cliquables |
| Directeur | Oui | Oui | Oui | Onglets Sans table / Avec table, lignes cliquables |
| Placeur | Oui | Non | Oui | Seulement le staff `notable` sans table |
| Agent scan (`agent_checkin`) | Oui | Non | Oui | Seulement le staff `notable` sans table |
| Visibilité | Oui | Oui | Non | Onglets Sans table / Avec table, lecture seule |

La section Staff du dashboard utilise `viewAllStaff`. Le raccourci Staff et le QR `STAFF` sur `/scan` utilisent `viewStaff` et restent naturellement invisibles à visibilité, qui n'a pas la capacité `scan` et ne peut pas ouvrir `/scan`.

## Barrière de sécurité

Le filtrage n'est jamais seulement visuel :

1. le middleware valide le cookie de session signé et l'accès au chemin;
2. `GET /api/staff` relit la session signée côté serveur et vérifie `viewStaff`;
3. l'API applique `viewAllStaff`; sans cette capacité, elle ne renvoie que les invitations portant un tag normalisé en `notable`;
4. la réponse porte `Cache-Control: private, no-store`;
5. `app/staff/page.tsx` consomme uniquement cette API et ne lit ni ne souscrit directement à `invitations`; ses actualisations périodiques et au retour au premier plan repassent par l'API protégée.

La clé `SUPABASE_SERVICE_ROLE_KEY` reste exclusivement dans `lib/supabase/admin.ts`, importé seulement par du code serveur. Ne jamais l'importer dans un composant `'use client'` et ne jamais créer de variable publique `NEXT_PUBLIC_*` contenant un secret.

## Comptes et PIN

Les noms de comptes peuvent être documentés pour l'exploitation. Les PIN, mots de passe, hash et jetons de session ne doivent jamais être ajoutés dans Git, README, `docs/`, changelog, PR, ticket ou message collectif. Ils restent gérés depuis `/admin/users` et stockés dans Supabase.

## Checklist obligatoire pour Claude

Avant toute modification des rôles ou de `/staff` :

1. lire `lib/permissions.ts`, `app/api/staff/route.ts`, `app/staff/page.tsx` et ce document;
2. modifier la capacité centrale plutôt qu'une liste de rôles locale;
3. protéger la route API même si le bouton ou la page est masqué;
4. mettre à jour la matrice dans `tests/permissions.test.ts` et `docs/BUSINESS_RULES.md`;
5. vérifier qu'aucun PIN ou secret n'apparaît dans le diff;
6. exécuter `npm run test:roles`, `npx tsc --noEmit` et `npm run build`;
7. documenter la version et les tests dans `CHANGELOG.md`;
8. ne faire aucune migration ou écriture Supabase sans autorisation explicite, sauvegarde et plan de retour arrière.
