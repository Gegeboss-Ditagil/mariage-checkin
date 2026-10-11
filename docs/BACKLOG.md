# Backlog — limites connues et actions en attente

**Version documentaire : 1.79.3**
**Dernière mise à jour : 2026-10-10**

Règle (v1.75.0, `docs/QE_QA_PROCESS.md` §6.6) : toute limite « signalée » dans une PR ou le CHANGELOG est ajoutée ici, avec un responsable, puis retirée quand elle est traitée. Le CHANGELOG raconte ce qui a été fait ; ce fichier dit ce qui reste à faire.

| # | Élément | Pourquoi c'est important | Responsable | Statut |
|---|---|---|---|---|
| 1 | Exécuter `supabase/manual/2026-10-10_appliquer_0069_et_nettoyer_historique.sql` dans l'éditeur SQL Supabase | Applique 0069 et nettoie l'historique des migrations. | Gersom | **Fait le 10/10/2026** (contrôle de santé vide, 0 doublon) |
| 2 | Créer 5 comptes de test (un par rôle) + secrets GitHub `E2E_*` (voir `e2e/README.md`) | Sans eux, les parcours « première utilisation » dans un vrai navigateur ne peuvent pas tourner. | Gersom | À faire |
| 3 | Quota Copilot épuisé : le check `github-advanced-security` est rouge sur chaque PR | Signal de sécurité indisponible ; CodeQL reste vert. | Gersom | À surveiller |
| 4 | Remplacer progressivement les tests « le code contient X » (1 516 assertions) par des tests de résultat | Ils passent même quand la fonctionnalité est cassée. | Agent, au fil des modifications | En cours |
| 5 | `/checkin/[id]/merge` reste ouvrable par URL pour `agent_checkin` (l'API refuse l'écriture) | Limite de `canAccessPath` (préfixes) ; sans risque de données, mais écran inutile pour ce rôle. | Agent | Connu |
| 6 | Relancer `scripts/sql-tests/01_first_use_flows.sql` et le contrôle de santé avant le jour J | Dernière vérification sur la vraie base. | Gersom / agent | Avant le jour J |
| 7 | Rendre obligatoire le check « Qualité » (GitHub → Settings → Branches → règle sur `main` → « Require status checks ») | Sans cette règle, une PR rouge peut encore être fusionnée. | Gersom | À faire |
| 8 | Vérifier à la main sur un vrai iPhone avant le jour J : lecture d'un vrai QR, photo « Invité surprise », notifications Push, installation de l'app | Les tests automatiques simulent la caméra et ne peuvent pas recevoir de Push réel. | Gersom + 1 scanneur | Avant le jour J |
| 9 | Supprimer les tables `canada_jets_leads` / `canada_jets_lead_events` (autre projet, vides, aucune dépendance) | Une règle permettait à quiconque possède la clé publique de l'app d'y insérer des lignes. Suppression décidée par Gersom le 10/10/2026, SQL fourni (éditeur SQL). | Gersom | **Fait le 10/10/2026** (vérifié) |
| 10 | Exécuter `supabase/migrations/0070_reset_removes_test_surprise_guests.sql` dans l'éditeur SQL (+ l'inscription d'historique de `docs/MIGRATIONS_PRODUCTION.md`), puis bouton rouge en Mode test | Sans elle, le bouton rouge laisse les invités surprise des essais (Sergio, Test). | Gersom | **Fait le 10/10/2026** (vérifié) |
| 11 | Exécuter `supabase/migrations/0071_remove_invitations_without_table_groups_1_3.sql` dans l'éditeur SQL (+ inscription d'historique, `docs/MIGRATIONS_PRODUCTION.md`) | Supprime les 9 invitations sans table demandées (groupes 1-3). | Gersom | **Fait le 10/10/2026** (vérifié) |
| 12 | Trancher les écarts With Joy / seatplan.io / base listés dans CHANGELOG 1.79.1 (tables 26/27, 6/13, 30/41, Moussaoui, Doumbia…) | Le plan papier, With Joy et l'app ne disent pas encore la même chose pour ces personnes. | Gersom, puis agent | Fait en v1.79.3 sauf Steven Kimbau (encore dans With Joy, table 31, absent du plan) |
| 13 | Exécuter `supabase/migrations/0072_sync_guest_list_66_seatplan_20261010.sql` dans l'éditeur SQL (+ inscription d'historique) | Applique les noms et tables corrigés (guest-list_66) et supprime 5 fiches sans table. | Gersom | **Fait le 11/10/2026** (vérifié) |
| 14 | Exécuter `supabase/migrations/0073_sync_guest_list_67.sql` dans l'éditeur SQL (+ inscription d'historique) | Tables 6/13 et 26/27, Famille Doumbia, Frank Mbonda et Mademoissele Isokolele retirés (guest-list_67). | Gersom | À faire |
