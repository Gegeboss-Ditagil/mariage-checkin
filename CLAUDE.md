# Instructions Claude Code et autres agents IA

Avant toute modification, lire dans cet ordre :

1. `docs/BUSINESS_RULES.md`
2. `docs/DATA_AND_FORMS.md`
3. `docs/QA_SCENARIOS.md`
4. `README.md`

Les permissions sont centralisées dans `lib/permissions.ts`. Ne recréez pas de listes de rôles dispersées si une capacité existe déjà. Ajoutez ou modifiez la capacité, ses tests et la documentation dans le même commit.

Ne modifiez jamais Supabase ou Google Sheets en production sans autorisation explicite, aperçu des impacts, sauvegarde et procédure de retour arrière.
