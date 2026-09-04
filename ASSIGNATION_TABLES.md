# Assignation des tables — méthode et résultat

**Version documentaire : 1.41.3**
**Dernière mise à jour : 2026-09-04**
**Statut : appliqué en base et vérifié.**

Import initial réalisé à partir de l'export With Joy `guestlist_8.csv`. Les places marquées `confirmée` viennent des labels With Joy; les places `provisoire` restent à valider. `/plan-table` reflète l'état courant de la base.

**Depuis le 25/08/2026, la source de vérité des tables/placements n'est plus With Joy mais un tableur corrigé directement par la famille lors d'ateliers de réorganisation** (voir `docs/DATA_CHANGE_INSTRUCTIONS.md` section 6 et `CHANGELOG.md`, entrée « atelier famille »). With Joy reste utilisé uniquement pour les coordonnées de contact.

## Capacité cible actuelle

**41 tables au total** :
- **40 tables normales (1 à 40)**, capacité 10 chacune → **400 places officielles** ;
- **1 seule table de réserve (41)**, capacité 10 ;
- capacité maximale absolue : **410 places**, mais l'objectif opérationnel reste **400 personnes**.

Les anciennes tables de réserve 38, 39 et 40 sont devenues des tables normales sans déplacer leurs occupants. La table 41 est la seule réserve.

## Méthode utilisée

1. **Labels With Joy honorés en priorité.** Les tags `T0xx` / `F0xx` sont respectés et ces placements sont marqués `confirmée`.
2. **RSVP décliné = exclu.** Toute personne ayant répondu explicitement qu'elle ne viendra pas n'est pas importée.
3. **Côté et tags** sont stockés sur chaque invitation pour expliquer le placement.
4. **Le reste est réparti provisoirement** sur les tables disponibles sans casser un foyer sauf contradiction explicite de labels.
5. En dernier recours, le débordement planifié peut aller vers **la table 41**, unique réserve. Les débordements du jour J peuvent néanmoins être affectés à toute table selon les règles métier.

## Scripts

Les scripts historiques dans `scripts/` documentent les imports et assignations. Avant tout futur ré-import, vérifier qu'ils correspondent bien au modèle **40 tables normales + 1 réserve**. Ne jamais réutiliser une constante historique 37/3 sans la corriger.

## Changement de structure v1.1.0

La migration `supabase/migrations/0019_reduce_reserve_to_one_table.sql` versionne le passage à 41 tables. Toute modification future de capacité doit être accompagnée d'une nouvelle migration, d'une entrée dans `CHANGELOG.md` et d'une mise à jour des documents versionnés.

## Comment ajuster si besoin

- Modifier une place : depuis l'application de préférence; sinon uniquement avec procédure de changement de données documentée.
- Changer capacités ou tables : `/admin/tables` et migration GitHub si la structure de référence change.
- Relancer un import : suivre `docs/DATA_CHANGE_INSTRUCTIONS.md` et contrôler les totaux avant/après.
