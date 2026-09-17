'use client';

import { useTransitionRouter as useRouter } from 'next-view-transitions';
import { useEffect, useRef } from 'react';

// Retour de Gersom le 17/09/2026 : "quand on swipe à partir de la gauche
// vers la droite... ça fonctionne, mais seulement si je mets mon doigt
// vraiment sur le bout de l'écran... j'aimerais que ce soit un peu plus
// intuitif, vraiment un peu comme iOS". Le geste "glisser depuis le bord
// gauche pour revenir en arrière" que ressent Gersom est en réalité le
// geste système d'iOS pour les apps installées sur l'écran d'accueil --
// sa zone de détection est fixée par iOS lui-même (aucune API web ne permet
// de l'élargir). Ce hook implémente donc notre propre geste, en plus,
// avec une zone de départ volontairement plus généreuse que celle d'iOS.
const EDGE_ZONE_PX = 32; // largeur depuis le bord gauche ou le geste peut demarrer
const SWIPE_THRESHOLD_PX = 60; // deplacement horizontal avant de declencher le retour
const VERTICAL_CANCEL_PX = 40; // deplacement vertical qui annule (defilement normal)

/**
 * Geste "glisser depuis le bord gauche vers la droite" pour revenir en
 * arrière, avec une zone de départ plus large et plus tolérante que le
 * geste système iOS. `backHref` doit être la même destination que la
 * flèche "‹" visible (voir TopBar.tsx, `effectiveBackHref`) -- le geste
 * ne fait jamais autre chose que ce que ce bouton ferait déjà.
 */
export function useSwipeBack(backHref: string | undefined) {
  const router = useRouter();
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const active = useRef(false);
  const hrefRef = useRef(backHref);
  hrefRef.current = backHref;

  useEffect(() => {
    if (!backHref) return;

    function reset() {
      active.current = false;
      startX.current = null;
      startY.current = null;
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) {
        reset();
        return;
      }
      const touch = e.touches[0];
      if (touch.clientX <= EDGE_ZONE_PX) {
        startX.current = touch.clientX;
        startY.current = touch.clientY;
        active.current = true;
      } else {
        reset();
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (!active.current || startX.current == null || startY.current == null) return;
      if (e.touches.length > 1) {
        reset();
        return;
      }
      const touch = e.touches[0];
      const dx = touch.clientX - startX.current;
      const dy = Math.abs(touch.clientY - startY.current);
      // Un deplacement surtout vertical (defilement normal de la liste)
      // annule le suivi -- meme garde que hooks/usePullToRefresh.ts.
      if (dy > VERTICAL_CANCEL_PX && dy > dx) {
        reset();
        return;
      }
      if (dx >= SWIPE_THRESHOLD_PX) {
        const href = hrefRef.current;
        reset();
        if (href) router.push(href);
      }
    }

    // Le systeme annule parfois la sequence tactile sans jamais declencher
    // touchend (un appel entrant, le navigateur qui reprend le geste comme
    // un defilement natif...) -- sans ce filet, `active` pourrait rester a
    // `true` et un prochain touchmove ailleurs sur l'ecran declencherait le
    // retour a tort.
    function onTouchEnd() {
      reset();
    }
    function onTouchCancel() {
      reset();
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [backHref, router]);
}
