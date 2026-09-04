# Instructions Claude Code et autres agents IA

**Version documentaire : 1.41.1**
**Dernière mise à jour : 2026-09-04**

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
- v1.34.0 : `auto_assign_table_for_guest_approval` (`0045_auto_assign_table_for_guest_approval.sql`, exécutée et vérifiée en production Supabase le 02/09/2026, `SECURITY INVOKER`) place automatiquement une demande approuvée sans réservation préalable — table excédentaire en priorité, sinon la table la plus libre du même côté que l'invité, sinon de l'autre côté, sinon approuvée sans table. `/approbations` ne propose plus de réserver une table manuellement comme parcours principal (retour de Gersom : « je n'ai pas besoin de voir réserver une table directement... être capable de approuver ou refuser rapidement ») ; le mécanisme de réservation de 0044 reste fonctionnel sous le capot. `app/globals.css` : `.card`/`.action-row`/`.action-row-muted`/`.btn-secondary` reprennent le thème « verre liquide » (flou + saturation + reflet + `var(--elev-2)`) déjà utilisé par la barre du bas, dans les deux thèmes — ne pas revenir à `shadow-card` (`var(--elev-1)`, `none` en Maison).
- v1.35.0 : `linked_invitation_id` (`0046_guest_approval_linked_invitation.sql`, exécutée et vérifiée en production Supabase le 02/09/2026) lie une demande d'invité surprise à l'invitation du groupe avec qui la personne est arrivée — nouveau point d'entrée sur `/checkin/[invitationId]` (« 📷 Invité surprise », réservé à `submitGuestApproval`), côté préempli depuis l'invitation. `auto_assign_table_for_guest_approval` gagne une priorité 0 : la table de ce groupe si elle a de la place, avant même la table excédentaire. **`app/api/members/add-unplanned/route.ts` exige désormais `submitGuestApproval` au lieu de `checkin`** (retour de Gersom : « les scanners ne vont même pas traiter votre demande... c'est les placeurs qui vont gérer le reste ») — `agent_checkin` ne peut plus ajouter d'invité non prévu, ni par ce bouton ni par le nouveau parcours photo ; `set-arrival-status` (check-in normal) reste inchangé sur `checkin` pour tous.
- v1.36.0 : `+ Invité` devient un bouton rond en verre (`components/AddInvitationButton.tsx`, `.glass-icon-button` dans `app/globals.css` — même recette réutilisée pour la flèche Retour de `TopBar`), présent sur `/plan-table` ET `/dashboard`, toujours réservé à `addInvitation` (admin/directeur). `/admin/users` : bascule Actif/Désactivé en `.glass-toggle` (verre liquide) et changement de rôle/accès possible depuis la fiche d'édition — `PATCH /api/admin/users` exige le nouvel identifiant (email+mot de passe ou PIN) quand `role` change et efface le mode devenu obsolète, aucune migration nécessaire (`users_role_check`, 0015, accepte déjà les cinq rôles).
- v1.37.0 : `/agenda` remplace la longue liste de cases à cocher « Responsables » par `components/ResponsablePicker.tsx`, une fiche de recherche plein écran (équipe affichée par défaut, invités recherchés à partir de 2 caractères via `ilike` sur `invitations.nom_affichage`, jamais toute la liste chargée d'un coup). Toujours les mêmes deux champs (`assignee_ids`, `custom_assignees`), aucune migration.
- v1.38.0 : les réponses publiques d'approbation sont privées et non mises en cache; le check-in utilise les capacités centralisées; la réinitialisation de test est atomique via la migration `0047_atomic_reset_test_event_data.sql`.
- v1.38.1 : sur `/agenda`, les raccourcis latéraux `Agenda` et `Bord` sont inversés; `/dashboard` et `/scan` restent inchangés.
- v1.39.0 : la création d'une activité permet de choisir les responsables dès la modale « Nouvelle activité », avec les mêmes comptes, invités recherchés et noms libres que la modification.
- v1.39.1 : les approbations et abonnements push utilisent l'événement de la session; les lectures d'approbations sont sans cache et l'activation push gère iOS installé et Android.
- v1.39.2 : deux corrections d'affichage/navigation, aucune migration. (1) Le flash de navigation entre deux fiches d'une même route dynamique (`/table/[tableId]`, `/tables/[tableId]`, `/checkin/[invitationId]`, `/checkin/[invitationId]/members`) est corrigé : chaque page réinitialise son état au tout début de l'effet gardé sur le paramètre d'URL, avant de relancer la requête (Next.js réutilise l'instance de composant, l'état ne se réinitialise jamais tout seul). (2) Le "+" de `GuestArrivalPanel` (« Qui est arrivé ? ») appelle désormais `add_unplanned_arrival` au lieu de `add_invitation_member` — la personne ajoutée est nommée ET marquée arrivée immédiatement (déclenche l'assignation de table de réserve en cas de dépassement), réservé à la nouvelle capacité `canAdd` (= `submitGuestApproval`, distincte de `canManage` = `manageMembers` toujours réservée au renommage). L'ancien bouton autonome « + Non prévu » et le lien « Gérer les membres du groupe » ont disparu de `/checkin/[invitationId]` (consolidés dans ce "+" ; la route `/checkin/[invitationId]/members` reste fonctionnelle par URL directe). « 📷 Invité surprise » est inchangé. `/plan-table` reflète maintenant les arrivées ajoutées ainsi, sans changement de code de son côté (son abonnement temps réel était déjà correct).
- v1.40.0 : optimisations « jour J » + version visible sur le splash, aucune migration. (1) Temps réel : les UPDATE `postgres_changes` sont appliqués localement (`lib/realtimeDelta.ts`) par `/dashboard`, `/plan-table`, `/exceptions`, `/tables/[tableId]` (+ ancienne route `/table/[tableId]`) et `GuestArrivalPanel` au lieu d'un refetch complet ; INSERT/DELETE restent debouncés à 400 ms ; la souscription `guests` du panneau est filtrée localement par ids déjà listés. (2) `hooks/usePolling.ts` suspend les intervalles (`AccountMenu`, `GuestApprovalsShortcut`, `BottomNav`, `/staff`, `/agenda`, `/approbations`) quand l'onglet est masqué. (3) `lib/supabase/client.ts` : singleton navigateur par onglet. (4) `/search` : dataset complet chargé seulement en mode « parcourir », colonnes réduites ; `/tables/move-multiple` : une requête `Promise.all` ; `xlsx` en import dynamique sur les pages admin ; `poweredByHeader: false`. (5) `app/page.tsx` lit `package.json` (`version`) et le passe à `SplashScreen` (badge « v1.40.0 » en bas à droite).
- v1.41.0 : forçage d'assignation d'un invité surprise sur une table pleine (migration `0049`, `p_force` ajouté à `assign_table_to_guest_approval_strict`, défaut false = comportement strict inchangé ; capacité cible non bloquante si forcé, destinations d'une réorganisation restent strictes, arrivés jamais déplacés, tracé dans `audit_logs`). Toggle « Forcer le placement » sur `/approbations/[id]/assign`. Correctif test `navigation-resilience.test.ts` (fenêtre `{0,200}` → `{0,400}`).


## Reprise rapide pour Claude AI

1. Commencer par `git fetch origin main` et comparer `HEAD` à `origin/main`; ne jamais supposer qu'un diff transmis est encore manquant.
2. Vérifier `package.json` : la version attendue au moment de cette transmission est `1.40.0`.
3. Pour les approbations, lire ensemble `app/approbations/page.tsx`, `app/approbations/[id]/assign/page.tsx`, `lib/guestApprovalDecide.ts`, `lib/webPush.ts` et la migration `0038`.
4. Pour la navigation, modifier la source centralisée `components/BottomNav.tsx`; ne pas recopier des menus dans les pages.
5. Ne pas modifier la règle des rôles sans mettre à jour `lib/permissions.ts`, les routes API, `tests/permissions.test.ts`, `tests/guest-approvals.test.ts` et `docs/BUSINESS_RULES.md` dans le même lot.
6. Avant livraison : `npx tsc --noEmit`, toutes les suites `node --test tests/*.test.ts`, `npm run build`, puis `git diff --check`.
7. Les prochains changements doivent passer par une branche et une PR pour permettre la révision avant fusion; ne pousser directement sur `main` que si Gersom le demande explicitement.
