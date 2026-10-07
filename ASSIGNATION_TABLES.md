# Assignation des tables — méthode et résultat

**Version documentaire : 1.68.2**
**Dernière mise à jour : 2026-10-06**
**Statut : appliqué en base et vérifié.**

Import initial réalisé à partir de l'export With Joy `guestlist_8.csv`. Les places marquées `confirmée` viennent des labels With Joy; les places `provisoire` restent à valider. `/plan-table` reflète l'état courant de la base.

**Depuis le 25/08/2026, la source de vérité des tables/placements n'est plus With Joy mais un tableur corrigé directement par la famille lors d'ateliers de réorganisation** (voir `docs/DATA_CHANGE_INSTRUCTIONS.md` section 6 et `CHANGELOG.md`, entrée « atelier famille »). With Joy reste utilisé uniquement pour les coordonnées de contact.

## Capacité cible actuelle

**42 tables actives** (depuis le 07/10/2026, v1.72.0 — migration `0066`, demande explicite de Gersom) :
- **40 tables normales (2 à 41)**, capacité 10 chacune → **400 places officielles** ;
- **2 tables de réserve « excédentaires » : table 1 « Maquela do Zombo » puis table 42**, capacité 10 chacune, vides ;
- capacité maximale absolue : **420 places**, mais l’objectif opérationnel reste **400 personnes**.

Revient sur la structure v1.68.0 (05/10/2026, 41 tables) : la table 42 redevient l'unique réserve, la table 41 devient une table normale désormais occupée par un vrai groupe de convives (confirmé par le PDF export seatplan.io du 06/10/2026 et le CSV `guest-list_58.csv`, qui ne tague plus aucune invitation sur la table 42). La table 42 n'avait jamais été supprimée en v1.68.0 (seulement décommissionnée, `capacity = 0`), précisément pour permettre ce genre de retournement sans perte des références historiques dans `audit_logs.table_id`.

## Méthode utilisée

1. **Labels With Joy honorés en priorité.** Les tags `T0xx` / `F0xx` sont respectés et ces placements sont marqués `confirmée`.
2. **RSVP décliné = exclu.** Toute personne ayant répondu explicitement qu'elle ne viendra pas n'est pas importée.
3. **Côté et tags** sont stockés sur chaque invitation pour expliquer le placement.
4. **Le reste est réparti provisoirement** sur les tables disponibles sans casser un foyer sauf contradiction explicite de labels.
5. En dernier recours, le débordement planifié peut aller vers **la table 1 puis la table 42**, les deux réserves. Les débordements du jour J peuvent néanmoins être affectés à toute table selon les règles métier.

## Scripts

Les scripts historiques dans `scripts/` documentent les imports et assignations. Avant tout futur ré-import, vérifier qu'ils correspondent bien au modèle **41 tables normales + 1 réserve**. Ne jamais réutiliser une constante historique 37/3/40/41 (ancienne structure) sans la corriger.

## Changement de structure v1.1.0, puis v1.47.0, puis v1.68.0, puis v1.68.2

La migration `supabase/migrations/0019_reduce_reserve_to_one_table.sql` versionne le passage à 41 tables (v1.1.0). La migration `supabase/migrations/0051_table_42_johannesburg_reserve.sql` versionne le passage à 42 tables (v1.47.0, 14/09/2026) : la 41 devient régulière (« Houston »), la 42 (« Johannesburg ») devient l'unique réserve. La migration `supabase/migrations/0061_table41_reserve_remove_table42.sql` (v1.68.0, 05/10/2026) revient sur ce changement : la 41 redevient l'unique réserve, la 42 est décommissionnée (pas supprimée, voir ci-dessus). La migration `supabase/migrations/0062_table42_reserve_table41_regular.sql` (v1.68.2, 06/10/2026) inverse à nouveau 0061 : la 42 redevient l'unique réserve, la 41 redevient une table normale. Toute modification future de capacité doit être accompagnée d'une nouvelle migration, d'une entrée dans `CHANGELOG.md` et d'une mise à jour des documents versionnés.

## Comment ajuster si besoin

- Modifier une place : depuis l'application de préférence; sinon uniquement avec procédure de changement de données documentée.
- Changer capacités ou tables : `/admin/tables` et migration GitHub si la structure de référence change.
- Relancer un import : suivre `docs/DATA_CHANGE_INSTRUCTIONS.md` et contrôler les totaux avant/après.
