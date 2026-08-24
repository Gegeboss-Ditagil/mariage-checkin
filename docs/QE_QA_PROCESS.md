# Processus QE/QA pour les bugs

**Version documentaire : 1.15.2**
**Dernière mise à jour : 2026-08-23**

Ce document distingue deux moments différents et fixe ce qui est obligatoire à chacun :

- **QE (Quality Engineering)** : préventif, avant de merger un changement.
- **QA (Quality Assurance)** : réactif, quand un bug est signalé, jusqu'à ce qu'il soit réellement clos.

Motivation : plusieurs bugs récents sur `/staff` (téléphone manquant, foyer entier compté comme staff au lieu d'un seul membre, `Groomsman`/`Bridesmaid` comptés à tort comme staff, staff `notable` réassigné à une table) venaient tous du même endroit — `scripts/build_plan_from_csv.py` — et n'ont été détectés qu'après coup, à l'œil, sur l'écran réel. Ce document existe pour attraper la prochaine fois plus tôt et plus systématiquement.

## 1. QE — avant de merger un changement touchant aux données ou aux règles métier

1. Identifier les documents impactés (`docs/BUSINESS_RULES.md`, `docs/DATA_AND_FORMS.md`, `docs/QA_SCENARIOS.md`, `docs/VERSIONING.md`, `CHANGELOG.md`) et les mettre à jour dans le même lot.
2. Écrire ou étendre un test automatisé qui vérifie explicitement la règle métier changée — pas seulement « le script ne plante pas ». Un test qui ne peut pas échouer sur le bug qu'on vient de corriger n'a pas de valeur.
3. Exécuter la suite complète avant de proposer le changement : `python3 -m unittest tests.test_import_scripts`, `npx tsc --noEmit`, `npm run build`.
4. **Parcourir la matrice complète de la section 4 ci-dessous, ligne par ligne, pas seulement le cas qu'on vient de corriger.** Un changement dans `scripts/build_plan_from_csv.py` ou `assign_tables_from_labels.py` peut casser un cas sans rapport avec celui qu'on visait (ex : corriger l'individuation du staff a un temps laissé passer le cas « double tag de table » sans avertissement, alors que rien dans le changement ne le touchait directement). Chaque ligne doit avoir un test qui échoue si la règle est violée — une case cochée sans test correspondant ne compte pas.
5. Si le changement touche la production (Supabase), suivre intégralement `docs/DATA_CHANGE_INSTRUCTIONS.md` (autorisation explicite, aperçu avant/après, sauvegarde, retour arrière) **et** vérifier par requête groupée que chaque ligne de la matrice reste vraie sur les données réelles après l'opération (pas seulement sur les cas synthétiques des tests).

## 2. QA — quand un bug est signalé

1. **Reproduire avec les vraies données** quand c'est possible — une requête Supabase directe (`select ... where ...`), pas une relecture du code à l'œil. Un bug de données et un bug de code se corrigent différemment ; ne pas conclure avant d'avoir vu la donnée réelle.
2. **Isoler la cause racine** : bug dans le script/la page (va se reproduire au prochain import/affichage) vs donnée déjà en base issue d'un import raté (ponctuel, à corriger une fois). Corriger les deux séparément — corriger seulement la donnée sans corriger le script garantit la récidive au prochain import.
3. **Chercher les cas similaires non signalés** par une requête groupée plutôt que corriger cas par cas ce que l'utilisateur a listé. Exemple concret : l'utilisateur a signalé Messi Matoko mal placé → la bonne question immédiate est « combien d'autres `notable` sans tag de table explicite ont aussi reçu une table par erreur ? », pas seulement corriger Messi Matoko.
4. **Écrire un test de régression avant de considérer le bug clos.**
5. **Documenter dans `CHANGELOG.md`** : section Corrigé (comportement) + section Données si la production a été modifiée manuellement, avec un avant/après chiffré (ex. « 65 → 59 invitations Staff, 3 remises sans table »). Bump de version selon `docs/VERSIONING.md` (PATCH pour une correction sans nouvelle fonctionnalité).
6. **Rapporter à l'utilisateur** ce qui a changé, pourquoi, et ce qui a été vérifié — pas seulement « c'est corrigé ».

## 3. Quand s'arrêter et demander plutôt que deviner

- Toute règle métier ambiguë découverte pendant une correction (ex. « quelqu'un avec à la fois `Groomsman` et `SERVICES` est-il staff ? ») — poser la question plutôt que trancher silencieusement.
- Toute modification manuelle de données de production : autorisation explicite requise (déjà couvert par `docs/DATA_CHANGE_INSTRUCTIONS.md`, rappelé ici car c'est le point où la plupart des bugs de ce projet ont été introduits).

## 4. Matrice de cas — import With Joy (`scripts/build_plan_from_csv.py` / `assign_tables_from_labels.py`)

Liste exhaustive à ce jour. Toute correction touchant ces scripts doit repasser sur **chaque ligne**, pas uniquement celle liée au bug signalé. Ajouter une ligne dès qu'un nouveau cas est découvert — cette matrice doit rester à jour, jamais figée.

| # | Cas | Règle attendue | Test couvrant |
|---|---|---|---|
| 1 | Tag de table explicite (`T0xx`/`F0xx`) + `notable` | Le tag de table gagne, avec un `WARNING` affiché | `test_notable_reste_sans_table_sauf_tag_explicite` |
| 2 | `notable` sans aucun tag de table | Reste volontairement sans table (`table_id = NULL`, `placement_status = 'provisoire'`) | `test_notable_reste_sans_table_sauf_tag_explicite` |
| 3 | Foyer où un seul membre porte un tag de rôle staff | Seule cette personne est `category = 'Staff'`, isolée dans sa propre invitation ; le reste du foyer reste groupé, non-staff | `test_staff_individuel_isole_du_foyer_avec_telephone` |
| 4 | Foyer où **tous** les membres portent un tag de rôle staff | Chaque personne est isolée individuellement (pour permettre de cocher l'arrivée de chacune séparément), pas groupée en une seule invitation `Staff` | `test_foyer_entierement_staff_isole_chaque_personne` |
| 5 | Tag `Groomsman`/`Bridesmaid` seul (cortège) | N'est jamais `category = 'Staff'` | `test_groomsman_bridesmaid_ne_sont_pas_du_staff` |
| 6 | Tag `Groomsman`/`Bridesmaid` **combiné** à un vrai tag de rôle staff (ex: `SERVICES`) | Reste `category = 'Staff'` — le cortège n'annule pas un rôle staff réel | `test_groomsman_avec_tag_staff_reste_staff` |
| 7 | Une personne porte deux tags de table (`T027` + `T036`) | Placée sur le premier rencontré, **et** un `WARNING` explicite est affiché pour que l'opérateur sache que le second est ignoré | `test_avertit_sur_double_tag_de_table` |
| 8 | Téléphone (`phone number`) par personne, invitation groupée | Le téléphone retenu est celui du premier membre du groupe qui en a un | `test_staff_individuel_isole_du_foyer_avec_telephone` |
| 9 | RSVP décliné (`Non, nous allons manquer le vol`) | Exclu entièrement (personne seule ou foyer), compté dans `declined_report` | `test_rsvp_decline_exclu_entierement` |
| 10 | Table explicite déjà pleine (débordement) | Bascule en pool aléatoire (`provisoire`), jamais rejetée silencieusement | `test_debordement_table_explicite_bascule_en_pool` |
| 11 | Pool aléatoire et réserve (table 41) saturés | Le script signale les invitations non placées (`unplaced`), ne les fait jamais disparaître | `test_capacite_totale_saturee_signale_les_non_places` |
| 12 | Capacité officielle dépassée (> 400 hors réserve) | Avertissement `DEPASSEMENT` affiché | **découverte lors de l'audit du 22/08/2026 : ce branch est du code mort.** Chaque table hors réserve est capée à 10 dès l'insertion (Étapes A et B) ; `officielles_count` est une somme sur des tables qui ne peuvent individuellement jamais dépasser 10 — donc `officielles_count > 400` ne peut mathématiquement jamais se produire avec l'algorithme actuel. Le message n'a jamais pu s'afficher. À décider avec Gersom : supprimer ce branch, ou le garder comme garde-fou pour un futur changement d'algorithme (auquel cas l'ajouter explicitement en commentaire pour ne pas le refaire passer pour un bug la prochaine fois qu'un agent le lit). |
| 13 | Invitation avec `table_id = NULL` (staff `notable` volontairement sans table, cas 2) affichée sur `/plan-table` et `/dashboard` | Ne compte ni dans les places officielles ni dans l'excédentaire/réserve — c'est un choix délibéré, pas un débordement. Doit apparaître à part (« sans table ») | **bug trouvé le 22/08/2026** : `app/plan-table/page.tsx` comptait tout `table_id` hors des tables normales comme « excédentaire en réserve », y compris `table_id = NULL` — 3 personnes (les staff `notable` du cas 2) apparaissaient à tort comme un dépassement de capacité alors que 0 personne n'était réellement en réserve. Corrigé : bucket `sansTable` séparé, `/dashboard` marque aussi le seuil des 400 sur la jauge (`CapacityGauge` avec `warningAt`). **Pas de test automatisé — ce sont des composants React non couverts par la suite actuelle (Python + `tests/permissions.test.ts`), à vérifier manuellement via `docs/QA_SCENARIOS.md` jusqu'à ce qu'un test de composant existe.** |
| 14 | Tag `Needs_Table_Gege` / `Needs_Table_Nelly` (nouveau tag With Joy, découvert le 22/08/2026) | Même intention que `notable` (cas 2) : jamais d'auto-assignation via le pool aléatoire (`no_table = True`), et n'est **pas** un tag de rôle staff — sans garde-fou, aurait été traité à tort comme du staff (comme n'importe quel tag inconnu). Toléré en casse variable (`needs_table_gege` fonctionne aussi). Un tag de table explicite reste prioritaire, même règle que le cas 1. | `test_needs_table_gege_nelly_reste_sans_table_et_nest_pas_staff` |
| 15 | Une ligne est retirée du brouillon avant la première initialisation des membres | `nombre_prevu` diminue au nombre réellement enregistré et le statut est recalculé dans la même transaction; l'initialisation ne peut jamais augmenter le prévu | `tests/members-migration.test.ts` + scénario QA 14 |

Les lignes 4, 9, 10, 11 étaient marquées comme dette de test — comblées le 22/08/2026 (voir `tests/test_import_scripts.py`, 11 tests au total avec la ligne 14 et la synchronisation SQL). La ligne 12 reste une découverte non actionnée, pas une dette de test : il n'y a rien à tester puisque le cas ne peut pas survenir. La ligne 13 est une vraie dette de test (composants React, pas de framework de test en place pour ça aujourd'hui).

## 5. Garde-fous transverses (au-delà de l'import With Joy)

Cas découverts hors de la matrice de la section 4, valables pour tout le projet :

- **`matchesPrefix` (`lib/permissions.ts`) ne couvre pas les routes qui commencent par le même mot sans `/`.** Découvert le 22/08/2026 en ajoutant `/tables/move-multiple` : le blocage existant pour `agent_checkin` sur `/tables/move` ne couvrait PAS `/tables/move-multiple` (`'/tables/move-multiple'.startsWith('/tables/move/')` est faux — le caractère après "move" est un tiret, pas un `/`). Chaque nouvelle route ajoutée sous un prefixe déjà partiellement bloqué doit être vérifiée explicitement avec un test (`tests/permissions.test.ts`), jamais supposée couverte parce que le nom commence pareil. Voir le test `agent scan ne peut pas transferer ou echanger en lot` dans `tests/permissions.test.ts`.
- **`matchesPrefix` ne peut pas non plus bloquer un sous-chemin qui suit un segment dynamique** (ex: `/checkin/[invitationId]/merge` — l'id vient avant `/merge`, donc aucun prefixe statique ne peut viser spécifiquement cette page sans aussi bloquer tout `/checkin/...`). Découvert le 22/08/2026 en ajoutant la fusion d'invitations : la page `/checkin/[id]/merge` reste atteignable par URL directe pour `agent_checkin`, mais `/api/invitations/merge` refuse l'écriture (même filet de sécurité que `/tables/move/[invitationId]` pour `visibilite` — commentaire déjà présent dans `canAccessPath`). Tant que le middleware fait du matching par préfixe de chaîne, ce type de route doit être protégé côté API, pas côté page — le vérifier explicitement plutôt que de supposer une régression de `canAccessPath`.
- **Une même règle métier implémentée deux fois (Python à l'import, SQL pour une modification manuelle) peut diverger silencieusement.** `add_invitation_tag`/`remove_invitation_tag` (`0022_manage_invitation_tags.sql`, puis correctif `0023_sync_needs_table_tag_rules.sql`) répliquent volontairement la liste `NON_ROLE_TAGS`/`is_role_tag` de `scripts/build_plan_from_csv.py` pour qu'ajouter un tag à la main produise le même `category` qu'un réimport avec ce même tag. Si cette liste change d'un côté (nouveau tag non-rôle découvert dans un futur export With Joy), la reporter immédiatement de l'autre côté — sinon un tag ajouté à la main et le même tag arrivant par CSV donneraient des résultats différents sans avertissement.
- **Une restriction d'accès doit suivre le scénario d'usage réel.** `/staff` a été restreint puis rouvert à placeur/agent scan le 22/08/2026 après confirmation que le staff sans table se présente à l'entrée générale. Ne pas réintroduire cette restriction sans une nouvelle décision métier explicite.
- **Ne jamais retranscrire à la main un gros bloc SQL contenant des données réelles.** Après toute écriture de masse, comparer automatiquement la base au fichier source vérifié, ligne par ligne et champ par champ; une exécution SQL réussie ne prouve pas que les données sont exactes.
- **Un hook chargé dans un `useEffect` expose d'abord un état vide.** Sur `/scan`, la caméra doit rester démontée tant que `useSessionRole()` renvoie `null`; sinon un QR déjà présenté peut être refusé avant le chargement du rôle.
- **`pgcrypto` n'est pas dans `public` sur ce projet Supabase — toujours qualifier `extensions.` dans une fonction.** Découvert le 23-24/08/2026 pendant la migration `0026_import_replace_invitations` : un premier `apply_migration` appelait `digest(...)` sans qualifier de schéma et a échoué à l'exécution (pas à la création — la fonction se crée sans erreur, l'échec n'apparaît qu'au premier appel), car l'extension `pgcrypto` est installée dans le schéma `extensions` sur ce projet, volontairement exclu du `search_path` sécurisé (`set search_path = public, pg_temp`) utilisé par les fonctions `SECURITY DEFINER`/`INVOKER` de ce projet. La transaction a échoué proprement, sans état partiel. Correctif : qualifier explicitement, ex. `extensions.digest(...)`, `extensions.gen_random_uuid()`. Toute future fonction Postgres de ce projet appelant `pgcrypto` doit faire de même — vérifié en production le 24/08/2026 (voir `CHANGELOG.md` v1.15.1/v1.15.2).

## Rattachement

Ce document fait partie de l'ordre de lecture obligatoire de `CLAUDE.md` et de la liste des documents versionnés de `docs/VERSIONING.md`.
