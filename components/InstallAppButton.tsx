'use client';

import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * Bouton flottant "Installer l'app" : sur Android/Chrome, declenche le
 * prompt d'installation natif (beforeinstallprompt). Sur iOS, Safari ne
 * propose pas d'installation programmatique -- on affiche a la place les
 * etapes manuelles (Partager -> Sur l'ecran d'accueil). Se cache tout seul
 * si l'app tourne deja en mode installe (standalone).
 */
export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setStandalone(isStandalone);

    const ua = window.navigator.userAgent || '';
    setIsIOS(/iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream);

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  if (standalone) return null;

  async function handleClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
      return;
    }
    // iOS (pas de prompt natif possible), ou Android/desktop sans prompt
    // capture pour l'instant : on affiche les etapes manuelles.
    setShowHelp(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="fixed bottom-5 right-5 z-20 flex items-center gap-2 rounded-full border border-gold-400/40 bg-night-800/95 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gold-200 shadow-gold backdrop-blur active:scale-[0.97] transition-transform"
      >
        ⬇ Installer l'app
      </button>

      {showHelp && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 px-4 pb-6 backdrop-blur-sm sm:items-center"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl3 border border-gold-400/25 bg-night-800 p-5 text-center shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-lg font-bold text-cream">Installer l'application</p>
            {isIOS ? (
              <div className="mt-3 space-y-2 text-left text-sm text-cream/70">
                <p>1. Touchez l'icône de partage (le carré avec une flèche vers le haut) en bas de Safari.</p>
                <p>2. Faites défiler puis touchez « Sur l'écran d'accueil ».</p>
                <p>3. Touchez « Ajouter » en haut à droite.</p>
              </div>
            ) : (
              <div className="mt-3 space-y-2 text-left text-sm text-cream/70">
                <p>
                  Ouvrez le menu de votre navigateur (⋮ ou …) puis choisissez « Installer l'application » ou
                  « Ajouter à l'écran d'accueil ».
                </p>
              </div>
            )}
            <button className="btn-secondary mt-5 w-full" onClick={() => setShowHelp(false)}>
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}
