# Instructions Claude Code et autres agents IA

**Version documentaire : 1.29.1**
**Dernière mise à jour : 2026-08-30**

Avant toute modification, lire dans cet ordre :

1. `package.json` — relever la version courante.
2. `CHANGELOG.md` — comprendre la dernière release.
3. `docs/VERSIONING.md` — appliquer la règle de versioning.
4. `docs/BUSINESS_RULES.md`
5. `docs/DATA_AND_FORMS.md`
6. `docs/DATA_CHANGE_INSTRUCTIONS.md`
7. `docs/QE_QA_PROCESS.md`
8. `docs/QA_SCENARIOS.md`
9. `docs/CLAUDE_HANDOFF_STAFF_ACCESS.md` pour tout changement de rôles ou de `/staff`
10. `README.md`

Avant de coder, rechercher les anciennes valeurs ou règles susceptibles d'être devenues obsolètes. Après la modification, vérifier que le code, les migrations et tous les documents concernés décrivent le même état.

En présence d'un bug (signalé par l'utilisateur ou constaté), suivre `docs/QE_QA_PROCESS.md` : reproduire avec les vraies données, distinguer bug de code (script/page) et bug de données déjà en base, chercher les cas similaires non signalés par une requête groupée avant de corriger cas par cas, écrire un test de régression avant de considérer le bug clos.

Dans chaque PR, indiquer explicitement : `Version: X.Y.Z → A.B.C` ou `Version inchangée: X.Y.Z`, les fichiers documentaires mis à jour, les tests exécutés et les éventuelles migrations.

Les permissions sont centralisées dans `lib/permissions.ts`. Ne recréez pas de listes de rôles dispersées si une capacité existe déjà. Ajoutez ou modifiez la capacité, ses tests et la documentation dans le même lot/version.

Ne modifiez jamais Supabase ou Google Sheets en production sans autorisation explicite, aperçu des impacts, sauvegarde et procédure de retour arrière. Toute modification manuelle de production doit être reflétée dans une migration GitHub et dans le changelog de la version correspondante.

## État de référence v1.15.3

- 41 tables : 40 normales (1-40) + une réserve (41).
- Capacité officielle : 400 places; capacité absolue : 410.
- Session maximale : 12 h.
- Une nouvelle version déployée invalide les sessions issues d'un ancien déploiement à la prochaine requête protégée.
- Le service worker ne doit pas servir d'anciens assets Next.js `/_next/*` depuis le cache.
