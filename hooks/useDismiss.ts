'use client';

import { useEffect, useRef, useState } from 'react';

// Duree de l'animation de sortie (voir .sheet-panel-closing / .sheet-card-closing
// / .sheet-backdrop-closing dans app/globals.css). Le panneau reste monte le
// temps de l'animation avant que le vrai onClose (qui demonte/ferme cote
// parent) ne soit appele -- retour de Gersom le 16/09/2026 : "corrige
// fluidifie" les transitions des panneaux modaux (fiche d'approbation,
// camera, selecteur de responsables...), qui jusque-la disparaissaient d'un
// coup, sans jamais d'animation de sortie.
const SHEET_EXIT_MS = 200;

export function useDismiss(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function dismiss() {
    if (closing) return;
    // Retire le focus (et referme un clavier/selecteur natif encore ouvert,
    // ex. <input type="time">) avant de demonter le panneau -- retour de
    // Gersom le 17/09/2026 (capture d'ecran /agenda) : un champ resté
    // focalisé au moment ou React retire ses noeuds du DOM peut laisser
    // WKWebView réafficher son clavier/roulette natif sur le prochain champ
    // de même type qui apparaît au même endroit, sans qu'aucun tap n'ait
    // demandé cette réouverture. Aucun effet si rien n'est focalisé.
    if (typeof document !== 'undefined') (document.activeElement as HTMLElement | null)?.blur?.();
    setClosing(true);
    const reducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timerRef.current = setTimeout(() => {
      onCloseRef.current();
      // v1.67.1, bug réel signalé par Gersom (capture d'écran /agenda) :
      // "la fiche pour modifier l'activité va sortir... après ça va être
      // fermé... après ça bug, je ne suis plus capable d'appuyer sur rien."
      // `closing` n'était JAMAIS remis à false ici -- pour un consommateur
      // persistant qui rouvre/referme le MEME panneau plusieurs fois sans
      // démonter tout le composant (ex. AgendaPage : `editing`/`insertAt`
      // sont un simple state interne, `useDismiss` n'est appelé qu'une
      // seule fois pour toute la vie de la page), `closing` restait collé à
      // `true` dès la toute première fermeture. À la réouverture suivante,
      // le panneau remontait directement avec les classes CSS "-closing"
      // (`sheet-backdrop-closing`/`sheet-card-closing`, `animation: ...
      // both` -- termine et reste à `opacity: 0`, jamais `pointer-events:
      // none`) : invisible mais toujours présent en `fixed inset-0 z-50`,
      // bloquant tout le reste de l'écran. Pire : `dismiss()` lui-même
      // refusait alors de rouvrir le cycle (`if (closing) return;`, déjà
      // vrai) -- le bouton de fermeture (X) devenait un no-op silencieux,
      // sans aucun moyen de s'en sortir autrement qu'en rechargeant la
      // page. Un composant qui démonte entièrement entre deux ouvertures
      // (nouvel appel à useDismiss, `closing` reparti à `false`) n'était
      // jamais touché -- seuls les consommateurs persistants l'étaient
      // (AgendaPage pour ses deux panneaux, la fiche détaillée de
      // `/approbations`, `InstallAppButton`).
      setClosing(false);
    }, reducedMotion ? 0 : SHEET_EXIT_MS);
  }

  return { closing, dismiss };
}
