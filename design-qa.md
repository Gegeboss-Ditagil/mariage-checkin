# Design QA — v1.29.5

- Source visual truth: demande de Gersom du 1er septembre 2026 décrivant l'iPhone/iPad en paysage, plus la capture de sélection multiple sur Table 8 demandant de remonter « Transférer / Échanger » dans un dock en verre façon iOS.
- Implementation screenshot: indisponible pour l'état authentifié paysage.
- Target viewports: iPhone paysage et iPad paysage.
- State: écran opérationnel authentifié utilisant `BottomNav`.

## Full-view comparison evidence

Bloqué avant comparaison visuelle 1:1 : aucune image source paysage n'est disponible et les écrans concernés exigent une session authentifiée. La cause structurelle est néanmoins vérifiée dans le code : le shell racine avait `max-w-md` sans levée en paysage, tandis que `BottomNav` possédait déjà sa variante verticale droite.

## Focused region comparison evidence

Non réalisable sans capture paysage authentifiée. Les zones à contrôler sur appareil réel sont la largeur complète du fond/contenu, le bord droit de la navigation, les safe areas et l'absence de chevauchement entre contenu défilant et barre verticale.

## Findings

- [Corrigé au niveau source] Le conteneur racine conserve `max-w-md` en portrait et applique `landscape:max-w-none` avec `w-full` en paysage.
- [Couvert automatiquement] Les onze écrans utilisant `BottomNav` gardent le patron `h-dvh ... landscape:flex-row`; la navigation garde `landscape:h-full`, `landscape:w-20`, `landscape:flex-col` et `landscape:safe-right`.
- [Corrigé au niveau source] Les deux routes de fiche table partagent maintenant `selection-action-dock` et `selection-action-button` : dock relevé de la safe area, flou 24 px, saturation 150 %, reflet intérieur et grandes cibles tactiles.
- [Bloqué visuellement] Typographie, rythme d'espacement, couleurs, qualité d'image et contenu ne changent pas dans ce lot, mais leur rendu paysage final doit être contrôlé sur iPhone/iPad authentifié.

## Comparison history

- Première passe : défaut identifié dans `app/layout.tsx`; correction globale appliquée et test de régression ajouté.
- Passe post-correctif : validation source et tests réussis; capture d'appareil réel indisponible.

## Implementation checklist

- Ouvrir un écran authentifié sur iPad paysage et vérifier que le fond et le contenu occupent toute la largeur disponible.
- Confirmer que la barre reste verticale, fixée au bord droit et respecte l'encoche/safe area.
- Faire défiler le contenu et vérifier que la barre ne bouge pas et ne masque aucune action.
- Refaire le contrôle sur iPhone paysage.

final result: blocked
