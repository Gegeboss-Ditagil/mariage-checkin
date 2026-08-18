# Assignation des tables — méthode et résultat

**Statut : appliqué en base et vérifié.** Les 200 invitations (423 personnes) ont chacune une table assignée dans Supabase (`invitations.table_id`). C'est une **proposition de départ automatique** — à relire et ajuster avant de la considérer définitive, notamment via `/admin/tables` et le futur écran de plan de salle.

## Méthode utilisée

1. **Regroupement par famille** : les invitations sont regroupées par le champ "groupe" du CSV (même nom de famille / même foyer), pour garder les membres d'une même famille sur des tables voisines plutôt que dispersés.
2. **Priorité "famille proche"** : les groupes contenant au moins une invitation taguée comme famille proche dans le CSV (parents Culumbu, parents Gégé, parents Nelly, famille Kumpesa Vemba, famille Mbidi Dos, etc. — 78 groupes / 185 personnes) sont placés en premier, sur les **7 tables "F"** (Maquela do Zombo, Kinshasa, Neuchâtel, Luanda, M'Banza Congo, Victoriaville, Genève). Si une famille proche déborde des tables F, elle continue sur les tables "T" dans l'ordre.
3. **Tout le reste** (le gros du volume — amis, collègues, DJ, MC, photographe, autres invités) est placé sur les **33 tables "T"**, dans l'ordre, en remplissant chaque table au mieux avant de passer à la suivante (algorithme "best fit" : chaque invitation va sur la table avec le moins de place restante qui peut encore la contenir, pour minimiser les trous).
4. **Débordement final** : si une table T ne suffit plus, le surplus va sur les **4 tables de réserve**.
5. Aucune invitation n'a été exclue : les 200 groupes (423 personnes), y compris le staff (DJ, MC, photographe, etc., traités comme les autres invités, comme demandé), sont tous placés.

## Résultat (vérifié en base après application)

- **200 / 200 invitations placées**, **423 / 423 personnes placées** — aucun manquant.
- Tables F (1 à 7) : **10/10** chacune (pleines).
- Tables T (8 à 40) : **10/10** chacune (pleines).
- Réserve 1 : **10/10** (pleine)
- Réserve 2 : **10/10** (pleine)
- Réserve 3 : **3/10**
- Réserve 4 : **0/10**

## ⚠️ Point important à valider avec vous

Les 40 tables "normales" (F + T) tombent exactement à 400 places pour 423 personnes attendues — l'algorithme a donc dû utiliser **23 places de réserve** rien que pour loger tout le monde au départ. Concrètement :

- Il ne reste que **13 places de réserve libres** (sur Réserve 3 et 4) pour absorber un vrai imprévu le jour J (invité surprise, accompagnant non prévu, erreur de comptage, etc.).
- Si vous préférez garder plus de marge de réserve, il faudra soit ajouter des tables normales, soit augmenter la capacité de certaines tables existantes (modifiable dans `/admin/tables`), puis relancer l'assignation.

Ceci n'est pas un bug : la capacité totale (44 tables × 10 = 440) est simplement proche du nombre de personnes (423), donc la réserve sert ici surtout à absorber le fait que 423 ne se divise pas parfaitement en groupes de 10 par table.

## Comment ajuster si besoin

- Modifier une place à la main : dans Supabase, table `invitations`, changer la colonne `table_id` d'une ligne — ou attendre l'écran de plan de salle dans l'admin.
- Changer les capacités de table : `/admin/tables` dans l'application.
- Relancer l'algorithme complet : les scripts `scripts/assign_tables.py` (calcule les familles proches) puis `scripts/pack_tables.py` (fait l'assignation) peuvent être réexécutés après modification des tables ou des invitations — ils ne touchent pas la base directement, ils régénèrent `scripts/table_assignments.json`, qui doit ensuite être réappliqué manuellement.
