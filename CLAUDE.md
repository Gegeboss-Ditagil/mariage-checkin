# Instructions Claude Code et autres agents IA

**Version documentaire : 1.33.1**
**Dernière mise à jour : 2026-09-02**

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

## État de référence v1.31.1

- 41 tables : 40 normales (1-40) + une réserve (41).
- Capacité officielle : 400 places; capacité absolue : 410.
- Session maximale : 12 h.
- Une nouvelle version déployée invalide les sessions issues d'un ancien déploiement à la prochaine requête protégée.
- Le service worker ne doit pas servir d'anciens assets Next.js `/_next/*` depuis le cache.
- `main` contient les commits `e37eb7b` (v1.29.1) et `006ce76` (v1.29.2).
- La migration `0038_strict_guest_approval_assignment.sql` a déjà été exécutée et vérifiée en production Supabase le 31/08/2026 : la fonction `assign_table_to_guest_approval_strict` existe avec `security_type = INVOKER`. Ne pas la réexécuter manuellement sans raison; conserver le fichier dans Git comme historique reproductible.
- `/approbations` ouvre la photo en grand et permet Approuver/Refuser. Dans l'application, `admin`, `directeur` et `visibilite` peuvent ensuite choisir la table ou laisser l'assignation au `placeur`; SMS/WhatsApp reste limité à Oui/Non.
- Une table pleine impose une réorganisation atomique : seuls les groupes avec `nombre_arrive = 0` peuvent être déplacés, et la fonction SQL refuse toute capacité cible ou destination dépassée.
- Les placeurs abonnés reçoivent un Push après approbation puis après assignation de la table. Ces notifications sont best-effort et ne conditionnent jamais la décision ou la transaction SQL.
- Navigation admin v1.29.2 : Approbations reste dans le menu du compte sur toutes les pages. Sur `/dashboard` seulement, la barre du bas est Recherche, Plan, Scan central, Agenda, Approbations. Hors dashboard, Approbations quitte la barre et Bord reprend le raccourci.
- Navigation v1.30.0 : pour admin/directeur, `/dashboard` utilise Scan au centre; `/scan` utilise Bord au centre. L’agenda partagé est stocké dans `agenda_items` et modifiable uniquement via la capacité `manageAgenda`.
- v1.30.1 : `ensure_invitation_member_rows` restaure les lignes nominatives manquantes sans modifier `nombre_prevu`/`nombre_arrive`. `manageTags` appartient à admin et directeur uniquement.
- v1.30.2 : la fiche d'approbation se ferme par un X; après approbation, Placement ouvre uniquement les tables ayant assez de places libres, avec priorité à la table 41.
- v1.31.0 : les activités de l'agenda sont entièrement modifiables; Nelly obtient l'exception nominative `users.agenda_manager` sans élargir les droits de tous les placeurs.
- v1.31.1 : Nelly est promue au rôle complet `directeur`, comme Rémy; l'application n'utilise plus l'exception nominative d'agenda.
- v1.33.1 : `app/api/agenda/route.ts` normalise `custom_assignees` en tableau même si la colonne venait à manquer côté base (`select('*')` omet silencieusement une colonne manquante — un spread sur `undefined` plantait toute `/agenda`, capturé par le filet générique `app/error.tsx` qui déconnecte l'utilisateur quelle que soit la vraie cause). `GET /api/guest-approvals?count=pending` porte désormais `Cache-Control: private, no-store` (comme la liste complète) et les trois appelants (`AccountMenu`, `BottomNav`, `GuestApprovalsShortcut`) passent `{ cache: 'no-store' }` — le badge d'approbations en attente est réellement en temps réel, plus figé par le cache HTTP du navigateur.
- Les migrations `0043_agenda_custom_assignees.sql` et `0044_guest_approval_pre_approval_reservation.sql` ont été exécutées et vérifiées en production Supabase le 02/09/2026 : `agenda_items.custom_assignees`, `guest_approval_requests.reserved_table_id`, et les fonctions `reserve_table_for_guest_approval`/`release_guest_approval_reservation` (toutes deux `SECURITY INVOKER`) existent en base. Ne pas les réexécuter manuellement sans raison; conserver les fichiers dans Git comme historique reproductible.

## Reprise rapide pour Claude AI

1. Commencer par `git fetch origin main` et comparer `HEAD` à `origin/main`; ne jamais supposer qu'un diff transmis est encore manquant.
2. Vérifier `package.json` : la version attendue au moment de cette transmission est `1.33.1`.
3. Pour les approbations, lire ensemble `app/approbations/page.tsx`, `app/approbations/[id]/assign/page.tsx`, `lib/guestApprovalDecide.ts`, `lib/webPush.ts` et la migration `0038`.
4. Pour la navigation, modifier la source centralisée `components/BottomNav.tsx`; ne pas recopier des menus dans les pages.
5. Ne pas modifier la règle des rôles sans mettre à jour `lib/permissions.ts`, les routes API, `tests/permissions.test.ts`, `tests/guest-approvals.test.ts` et `docs/BUSINESS_RULES.md` dans le même lot.
6. Avant livraison : `npx tsc --noEmit`, toutes les suites `node --test tests/*.test.ts`, `npm run build`, puis `git diff --check`.
7. Les prochains changements doivent passer par une branche et une PR pour permettre la révision avant fusion; ne pousser directement sur `main` que si Gersom le demande explicitement.
