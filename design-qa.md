# Design QA — v1.30.0

## Vérification du lot v1.30.0

- Sources visuelles : les deux captures iPhone du 1er septembre 2026 (Dashboard et Scan).
- Cible Dashboard : Recherche / Plan / Scan central / Agenda / Approbations.
- Cible Scan : Recherche / Plan / Bord central / Agenda / Approbations, avec une commande photo distincte sous le flux caméra.
- Résultat source : les deux variantes sont produites par `BottomNav` selon le chemin courant, sans doublon Scan/Bord. L’agenda conserve le langage visuel existant et ajoute des commandes d’insertion/affectation/validation.
- Vérification automatisée : 147 tests, TypeScript et build réussis.
- Capture authentifiée : bloquée. Le navigateur local est correctement redirigé vers `/login`; aucun identifiant de test ne peut être inventé ou utilisé pour franchir cette barrière.

Les contrôles visuels finaux à faire sur appareil connecté sont : absence de doublon dans chaque barre, ordre exact des cinq commandes, visibilité de la commande photo, ouverture des deux fenêtres Agenda et contraste clair/sombre.

- Source visual truth: demandes et captures de Gersom du 1er septembre 2026 : iPhone/iPad paysage, sélection multiple sur Table 8, fiche Approbation trop basse, liste dont les photos restent vides pendant le chargement, navigation directeur affichant Staff sans accès Scan, et Dock iOS bleu fourni comme référence précise de volume/verre/arrondi.
- Implementation screenshot: indisponible pour l'état authentifié paysage.
- Target viewports: iPhone portrait, iPhone paysage et iPad paysage.
- State: écrans opérationnels authentifiés utilisant `BottomNav`, dont la fiche modale d'une demande Approbation.

## Full-view comparison evidence

Bloqué avant comparaison visuelle 1:1 : aucune image source paysage n'est disponible et les écrans concernés exigent une session authentifiée. La cause structurelle est néanmoins vérifiée dans le code : le shell racine avait `max-w-md` sans levée en paysage, tandis que `BottomNav` possédait déjà sa variante verticale droite.

## Focused region comparison evidence

Non réalisable sans capture paysage authentifiée. Les zones à contrôler sur appareil réel sont la largeur complète du fond/contenu, le bord droit de la navigation, les safe areas et l'absence de chevauchement entre contenu défilant et barre verticale.

## Findings

- [Corrigé au niveau source] Le conteneur racine conserve `max-w-md` en portrait et applique `landscape:max-w-none` avec `w-full` en paysage.
- [Couvert automatiquement] Les onze écrans utilisant `BottomNav` gardent le patron `h-dvh ... landscape:flex-row`; la navigation garde `landscape:h-full`, `landscape:w-20`, `landscape:flex-col` et `landscape:safe-right`.
- [Corrigé au niveau source] Les deux routes de fiche table partagent maintenant `selection-action-dock` et `selection-action-button` : dock relevé de la safe area, flou 24 px, saturation 150 %, reflet intérieur et grandes cibles tactiles.
- [Corrigé au niveau source] La fiche Approbation est alignée en haut avec prise en compte de la safe area, conserve une hauteur défilable, et utilise une surface translucide bordée adaptée aux thèmes clair et sombre.
- [Corrigé au niveau source] Les chevrons texte ont été remplacés par les icônes directionnelles du système de composants, dans deux cibles tactiles 56 × 56 px flottantes, translucides et ombrées.
- [Corrigé au niveau source] Le bloc d'informations est découpé en cinq surfaces distinctes et les états approuvés indiquent sans ambiguïté si une table est attribuée.
- [Corrigé au niveau source] La fenêtre Approbation utilise désormais un centrage vertical réel (`items-center`) et une hauteur maximale laissant une marge uniforme autour du popup.
- [Corrigé au niveau source] Le splash précharge les six premières photos, la signature Storage est groupée et les nouvelles images sont réduites avant l'envoi; les cadres vides observés pendant plusieurs secondes ne devraient plus se reproduire pour les nouvelles demandes sur une connexion normale.
- [Corrigé au niveau source] La barre du directeur remplace Staff par Scan, conserve Bord au centre et renforce son effet flottant dans les deux thèmes.
- [Corrigé au niveau source] La barre basse reprend les proportions perceptuelles du Dock de référence : capsule 96 px/rayon 36 px, tuiles 44 px, icônes 30 px, centre 84 px, flou 34 px et saturation 185 %. Les couleurs Apple ne sont volontairement pas copiées afin de conserver les thèmes Atrium/Maison.
- [Corrigé au niveau source] Après validation de la forme, la matière devient plus proche d'une plaque Liquid Glass : fond 58 %/56 %, flou 34 px, saturation 185 %, bord lumineux et tuiles internes translucides plutôt qu'opaques.
- [Bloqué visuellement] Typographie, rythme d'espacement, couleurs, qualité d'image et contenu ne changent pas dans ce lot, mais leur rendu paysage final doit être contrôlé sur iPhone/iPad authentifié.

## Comparison history

- Première passe : défaut identifié dans `app/layout.tsx`; correction globale appliquée et test de régression ajouté.
- Passe post-correctif : validation source et tests réussis; capture d'appareil réel indisponible.

## Implementation checklist

- Ouvrir un écran authentifié sur iPad paysage et vérifier que le fond et le contenu occupent toute la largeur disponible.
- Confirmer que la barre reste verticale, fixée au bord droit et respecte l'encoche/safe area.
- Faire défiler le contenu et vérifier que la barre ne bouge pas et ne masque aucune action.
- Refaire le contrôle sur iPhone paysage.
- Sur iPhone portrait authentifié, ouvrir une approbation en thème clair puis sombre et vérifier la position haute, la lisibilité des cinq champs et la navigation par les deux flèches.

final result: blocked
