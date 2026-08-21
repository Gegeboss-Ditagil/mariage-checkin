# Assignation des tables — méthode et résultat

**Statut : appliqué en base et vérifié.** Import réalisé à partir de l'export "With Joy" `guestlist_8.csv`. C'est une **proposition qui se complète au fil des imports** — les places marquées "confirmée" sont figées par vos labels With Joy, les places "provisoire" restent à valider (voir `/plan-table` dans l'app, qui reste à jour en direct après chaque nouvel import).

## Capacité cible

**40 tables au total** : **37 tables "officielles"** (7 familiales + 30 de soirée, capacité 10 chacune → **370 invités max**) + **3 tables de réserve/excédentaire**. Objectif : ramener la liste sous 370 personnes au prochain import CSV ; en attendant, le surplus est placé en réserve (clairement marqué "Excédentaire" dans l'app).

## Méthode utilisée (guestlist_8, 2e ré-import)

1. **Labels With Joy honorés en priorité.** Vous avez commencé à taguer certains invités avec `T0xx` / `F0xx` (ex. `F003` = table 3, `T026` = table 26) directement dans With Joy. Chaque tag est respecté à la lettre — ces invitations sont marquées **confirmée**. Si un même foyer a des membres tagués différemment (label partiel ou contradictoire), le foyer est scindé en sous-groupes plutôt que de deviner : chaque sous-groupe va sur la table indiquée par son propre tag.
2. **RSVP décliné = exclu.** Toute personne ayant répondu explicitement *"Non, nous allons manquer le vol"* n'est pas importée du tout.
3. **Côté (Nelly / Gégé / Neutre) et famille proche** (Parents Culumbu, Parents Gege, Parents Nelly, Famille Kumpesa Vemba, Famille Mbidi DOS, Tonton Mbiki) sont détectés via les tags With Joy et stockés sur chaque invitation (`cote`, `tags`) pour affichage/filtre dans l'app.
4. **Le reste (aucun tag de table) est réparti aléatoirement** — foyer par foyer, sans le scinder — sur les tables encore totalement vierges de tout label, jamais sur une table déjà en cours de labellisation par vous. Si une table labellisée dépasse sa capacité de 10 (double-réservation), le surplus rejoint ce même pool "reste". Ces invitations sont marquées **provisoire**.
5. Si le pool des tables vierges ne suffit plus, le débordement va dans les 3 tables de réserve (`38, 39, 40`, renommées "Réserve 1/2/3" pour l'occasion).

## Scripts

- `scripts/build_plan_from_csv.py` — parse l'export With Joy, exclut les déclinés, détecte côté/tags/famille proche, découpe les foyers aux tags contradictoires.
- `scripts/assign_tables_from_labels.py` — applique la logique de placement (labels d'abord, reste randomisé, réserve en dernier recours) et affiche un résumé, avec alerte si les 370 places officielles sont dépassées.

Ni l'un ni l'autre ne touche la base directement : ils régénèrent des fichiers JSON qui doivent ensuite être réappliqués manuellement (`DELETE` + `INSERT` sur `invitations`).

## Comment ajuster si besoin

- Modifier une place à la main : dans Supabase, table `invitations`, changer la colonne `table_id` — ou depuis `/plan-table` / `/placement` dans l'app.
- Changer les capacités ou le nombre de tables : `/admin/tables` dans l'application.
- Relancer l'algorithme complet après un nouvel export With Joy : `build_plan_from_csv.py` puis `assign_tables_from_labels.py`.

