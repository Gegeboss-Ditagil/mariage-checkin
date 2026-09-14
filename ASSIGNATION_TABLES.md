# Assignation des tables — méthode et résultat

**Version documentaire : 1.51.0**
**Dernière mise à jour : 2026-09-14**
**Statut : appliqué en base et vérifié.**

Import initial réalisé à partir de l'export With Joy `guestlist_8.csv`. Les places marquées `confirmée` viennent des labels With Joy; les places `provisoire` restent à valider. `/plan-table` reflète l'état courant de la base.

**Depuis le 25/08/2026, la source de vérité des tables/placements n'est plus With Joy mais un tableur corrigé directement par la famille lors d'ateliers de réorganisation** (voir `docs/DATA_CHANGE_INSTRUCTIONS.md` section 6 et `CHANGELOG.md`, entrée « atelier famille »). With Joy reste utilisé uniquement pour les coordonnées de contact.

## Capacité cible actuelle

**42 tables au total** (depuis le 14/09/2026, v1.47.0 — nouvelle configuration demandée par Gersom) :
- **41 tables normales (1 à 41)**, capacité 10 chacune → **410 places officielles** ; la table 41, ex-réserve, a été renommée « Houston » et est devenue une table régulière ;
- **1 seule table de réserve (42, « Johannesburg »)**, capacité 10 ;
- capacité maximale absolue : **420 places**, mais l'objectif opérationnel reste **410 personnes**.

Les anciennes tables de réserve 38, 39 et 40 sont devenues des tables normales sans déplacer leurs occupants (v1.1.0), puis la table 41 a suivi le même chemin le 14/09/2026. La table 42 est désormais la seule réserve.

## Méthode utilisée

1. **Labels With Joy honorés en priorité.** Les tags `T0xx` / `F0xx` sont respectés et ces placements sont marqués `confirmée`.
2. **RSVP décliné = exclu.** Toute personne ayant répondu explicitement qu'elle ne viendra pas n'est pas importée.
3. **Côté et tags** sont stockés sur chaque invitation pour expliquer le placement.
4. **Le reste est réparti provisoirement** sur les tables disponibles sans casser un foyer sauf contradiction explicite de labels.
5. En dernier recours, le débordement planifié peut aller vers **la table 42**, unique réserve. Les débordements du jour J peuvent néanmoins être affectés à toute table selon les règles métier.

## Scripts

Les scripts historiques dans `scripts/` documentent les imports et assignations. Avant tout futur ré-import, vérifier qu'ils correspondent bien au modèle **41 tables normales + 1 réserve**. Ne jamais réutiliser une constante historique 37/3/40 sans la corriger.

## Changement de structure v1.1.0, puis v1.47.0

La migration `supabase/migrations/0019_reduce_reserve_to_one_table.sql` versionne le passage à 41 tables (v1.1.0). La migration `supabase/migrations/0051_table_42_johannesburg_reserve.sql` versionne le passage à 42 tables (v1.47.0, 14/09/2026) : la 41 devient régulière (« Houston »), la 42 (« Johannesburg ») devient l'unique réserve. Toute modification future de capacité doit être accompagnée d'une nouvelle migration, d'une entrée dans `CHANGELOG.md` et d'une mise à jour des documents versionnés.

## Comment ajuster si besoin

- Modifier une place : depuis l'application de préférence; sinon uniquement avec procédure de changement de données documentée.
- Changer capacités ou tables : `/admin/tables` et migration GitHub si la structure de référence change.
- Relancer un import : suivre `docs/DATA_CHANGE_INSTRUCTIONS.md` et contrôler les totaux avant/après.
