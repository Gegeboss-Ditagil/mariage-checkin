# Versioning et gouvernance des releases

**Version documentaire : 1.15.0**
**Dernière mise à jour : 2026-08-23**

## Source de vérité

La version courante de l'application est la valeur `version` dans `package.json`.
`CHANGELOG.md` décrit ce qui a changé dans chaque version. Tous les documents de référence doivent afficher la même version documentaire que l'application lorsqu'ils décrivent l'état courant.

## Convention

Le projet suit Semantic Versioning : `MAJOR.MINOR.PATCH`.

- `PATCH` : correction sans changement fonctionnel important ni migration incompatible.
- `MINOR` : nouvelle fonctionnalité, changement de comportement, nouveau parcours, nouvelle migration ou changement opérationnel compatible.
- `MAJOR` : changement incompatible nécessitant migration, rupture de contrat ou procédure spéciale pour les utilisateurs/opérateurs.

## Règle obligatoire avant merge

Toute PR qui change le comportement de production doit :

1. identifier la version cible ;
2. mettre à jour `package.json` si la PR déclenche une nouvelle release ;
3. ajouter l'entrée correspondante dans `CHANGELOG.md` ;
4. mettre à jour les documents concernés ;
5. vérifier que les chiffres opérationnels et règles métier ne sont pas contradictoires ;
6. exécuter les contrôles QA pertinents (`docs/QE_QA_PROCESS.md`, `docs/QA_SCENARIOS.md`) ;
7. indiquer dans la PR la version avant et la version après.

Un merge qui modifie uniquement du texte sans changer le comportement peut conserver la version courante, mais doit mettre à jour la date documentaire si nécessaire.

## Documents versionnés

Les documents suivants décrivent l'état courant et doivent rester alignés :

- `README.md`
- `CLAUDE.md`
- `DEPLOIEMENT.md`
- `ASSIGNATION_TABLES.md`
- `docs/BUSINESS_RULES.md`
- `docs/DATA_AND_FORMS.md`
- `docs/DATA_CHANGE_INSTRUCTIONS.md`
- `docs/QE_QA_PROCESS.md`
- `docs/QA_SCENARIOS.md`
- `docs/VERSIONING.md`
- `CHANGELOG.md`

## Procédure pour Claude / agents IA

Avant toute modification :

1. lire `package.json` et relever la version courante ;
2. lire `CHANGELOG.md` pour comprendre la dernière release ;
3. lire `docs/VERSIONING.md` ;
4. lire `CLAUDE.md` et les documents métier/données/QA référencés ;
5. comparer la demande avec l'état réel du code ;
6. rechercher les anciennes valeurs devenues invalides avant de modifier ;
7. dans la PR, écrire explicitement `Version: X.Y.Z → A.B.C` ou `Version inchangée: X.Y.Z`.

Après modification, Claude doit confirmer que le code et les documents de référence correspondent à la même version.

## État v1.15.0

- 41 tables au total.
- Tables 1 à 40 : tables normales.
- Table 41 : seule table de réserve.
- Capacité officielle : 400 places.
- Capacité absolue avec réserve : 410 places.
- Session maximale : 12 heures.
- Une session issue d'un ancien déploiement est invalidée à la prochaine requête protégée.
- Les assets Next.js `/_next/*` ne sont pas servis depuis l'ancien cache PWA.
- Le staff dispose d'un écran d'arrivées dédié et d'un QR collectif `STAFF`.
