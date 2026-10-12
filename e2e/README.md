# Parcours de bout en bout « première utilisation » (v1.75.0)

Rejoue, dans un vrai navigateur (iPhone, Android, iPad), ce que vit un agent le
jour J la première fois qu'il ouvre l'application : connexion, choix du thème,
page d'arrivée, chaque onglet de la barre du bas, puis première ouverture d'une
invitation jamais ouverte. Un rôle par compte de test.

## Préparer (une fois)
1. Créer un compte de test par rôle dans `/admin/users` (PIN à 4 chiffres) :
   admin, directeur, placeur, agent_checkin (scanneur), visibilite (approbateur).
2. Dans GitHub → Settings → Secrets and variables → Actions, ajouter :
   `E2E_<ROLE>_NAME` et `E2E_<ROLE>_PIN` pour `ADMIN`, `DIRECTEUR`, `PLACEUR`,
   `AGENT_CHECKIN`, `VISIBILITE`.

### Comptes inutilisés réutilisables (état du 12/10/2026)
Comptes sans nom propre, jamais attribués à une personne — à utiliser pour les tests plutôt que d'en créer :
- `agent_checkin` : `Agent008` … `Agent016` et `Agent Test 1` (actuellement désactivés : les réactiver dans `/admin/users`).
- `placeur` : `Agent003` … `Agent007` (actifs), `Placeur Test` (désactivé). Ne pas utiliser `Agent002` (PIN déjà changé par le système).
- `admin`, `directeur`, `visibilite` : aucun compte inutilisé — à créer (ex. « Test Admin », « Test Directeur », « Test Approbateur »).
Le PIN de chaque compte de test se saisit dans `/admin/users` (« Nouveau PIN ») puis se copie dans les secrets GitHub.

## Avant chaque passage
1. Exécuter `scripts/sql-tests/02_e2e_fresh_invitation.sql` dans l'éditeur SQL
   Supabase ; copier l'id affiché dans le secret `E2E_FRESH_INVITATION_ID`.
2. Actions → « E2E première utilisation » → Run workflow → coller l'URL de
   l'aperçu Vercel de la PR.

## En local
```
E2E_BASE_URL=https://… E2E_PLACEUR_NAME=… E2E_PLACEUR_PIN=… npx playwright test
```
Un rôle sans identifiants est simplement ignoré.

## Tests SQL sur la vraie base (sans rien y laisser)
`scripts/sql-tests/01_first_use_flows.sql` : coller dans l'éditeur SQL Supabase.
Le résultat attendu est une erreur `SQL_TESTS_PASSED ...` : le bloc se termine
volontairement par une exception, ce qui annule toutes ses écritures.
