# Backlog — limites connues et actions en attente

**Version documentaire : 1.75.0**
**Dernière mise à jour : 2026-10-10**

Règle (v1.75.0, `docs/QE_QA_PROCESS.md` §6.6) : toute limite « signalée » dans une PR ou le CHANGELOG est ajoutée ici, avec un responsable, puis retirée quand elle est traitée. Le CHANGELOG raconte ce qui a été fait ; ce fichier dit ce qui reste à faire.

| # | Élément | Pourquoi c'est important | Responsable | Statut |
|---|---|---|---|---|
| 1 | Exécuter `supabase/migrations/0069_health_report_reset_fix_strict_overload.sql` dans l'éditeur SQL Supabase | Supprime l'ancienne version ambiguë de la fonction de placement et crée la réinitialisation de test. L'outil de l'agent est bloqué sur les suppressions. | Gersom | À faire |
| 2 | Créer 5 comptes de test (un par rôle) + secrets GitHub `E2E_*` (voir `e2e/README.md`) | Sans eux, les parcours « première utilisation » dans un vrai navigateur ne peuvent pas tourner. | Gersom | À faire |
| 3 | Quota Copilot épuisé : le check `github-advanced-security` est rouge sur chaque PR | Signal de sécurité indisponible ; CodeQL reste vert. | Gersom | À surveiller |
| 4 | Remplacer progressivement les tests « le code contient X » (1 516 assertions) par des tests de résultat | Ils passent même quand la fonctionnalité est cassée. | Agent, au fil des modifications | En cours |
| 5 | `/checkin/[id]/merge` reste ouvrable par URL pour `agent_checkin` (l'API refuse l'écriture) | Limite de `canAccessPath` (préfixes) ; sans risque de données, mais écran inutile pour ce rôle. | Agent | Connu |
| 6 | Relancer `scripts/sql-tests/01_first_use_flows.sql` et le contrôle de santé avant le jour J | Dernière vérification sur la vraie base. | Gersom / agent | Avant le jour J |
