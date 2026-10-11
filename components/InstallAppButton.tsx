'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useDismiss } from '@/hooks/useDismiss';
import {
  androidBrowserLabel,
  buildChromeIntentUrl,
  detectInstallPlatform,
  isChromeInstallHandoff,
  stripInstallParam,
  type InstallPlatform,
} from '@/lib/installPlatform';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * Bouton flottant "Installer l'app" (écran /login uniquement).
 *
 * - Chrome Android : déclenche le prompt d'installation natif
 *   (beforeinstallprompt) — APK fabriqué par Google, jamais bloqué.
 * - Autre navigateur Android (Samsung Internet, Xiaomi, WebView…) : v1.81.0,
 *   ces navigateurs fabriquent un APK visant une ancienne version d'Android,
 *   bloqué par Google Play Protect (« Appli non sécurisée bloquée »). On
 *   n'installe JAMAIS depuis ces navigateurs : le bouton rouvre la page dans
 *   Chrome (lien intent://, voir lib/installPlatform.ts), où l'aide
 *   s'ouvre directement grâce à ?install=chrome.
 * - iOS : Safari ne propose pas d'installation programmatique — étapes
 *   manuelles (Partager → Sur l'écran d'accueil).
 * Se cache tout seul si l'app tourne déjà en mode installé (standalone).
 */
export function InstallAppButton() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>('other');
  const [browserLabel, setBrowserLabel] = useState('ce navigateur');
  const [arrivedFromHandoff, setArrivedFromHandoff] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { closing: helpClosing, dismiss: dismissHelp } = useDismiss(() => setShowHelp(false));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setStandalone(isStandalone);

    const ua = window.navigator.userAgent || '';
    const detected = detectInstallPlatform(ua);
    setPlatform(detected);
    setBrowserLabel(androidBrowserLabel(ua));

    // Arrivée dans Chrome via le bouton « Ouvrir dans Chrome » : on ouvre
    // directement l'aide, puis on retire ?install=chrome de l'URL pour
    // qu'un rechargement ne la rouvre pas.
    if (!isStandalone && isChromeInstallHandoff(window.location.search)) {
      setArrivedFromHandoff(true);
      setShowHelp(true);
      try {
        window.history.replaceState(window.history.state, '', stripInstallParam(window.location.href));
      } catch {
        /* sans effet : l'aide reste simplement ouverte */
      }
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  // Le listener beforeinstallprompt reste attache en permanence au niveau
  // racine (ci-dessus) pour ne jamais rater l'evenement, mais le BOUTON lui-
  // meme ne doit s'afficher que sur l'ecran de connexion (formulaire + message
  // de bienvenue, qui partagent tous les deux l'URL /login) : ailleurs, il
  // empietait en permanence sur la barre de navigation du bas.
  if (standalone || pathname !== '/login') return null;

  const mustUseChrome = platform === 'android-other';

  async function runNativePrompt() {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') setDeferredPrompt(null);
    return true;
  }

  async function handleClick() {
    // Jamais le prompt natif hors Chrome sur Android : c'est lui qui
    // fabrique l'APK bloqué par Play Protect.
    if (!mustUseChrome && (await runNativePrompt())) return;
    setShowHelp(true);
  }

  function openInChrome() {
    window.location.href = buildChromeIntentUrl(window.location.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="fixed bottom-5 right-5 z-20 flex items-center gap-2 rounded-full border border-hairline bg-glass px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-accent shadow-elev-2 backdrop-blur active:scale-[0.97] transition-transform"
      >
        {mustUseChrome ? "⬇ Installer via Chrome" : "⬇ Installer l'app"}
      </button>

      {showHelp && (
        <div
          className={'fixed inset-0 z-30 flex items-end justify-center bg-black/60 px-4 pb-6 backdrop-blur-sm sm:items-center ' + (helpClosing ? 'sheet-backdrop-closing' : 'sheet-backdrop')}
          onClick={dismissHelp}
        >
          <div
            className={'relative w-full max-w-sm rounded-xl3 border border-hairline bg-surface p-5 text-center shadow-card ' + (helpClosing ? 'sheet-card-closing' : 'sheet-card')}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={dismissHelp}
              aria-label="Fermer"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface-2 text-lg leading-none text-text active:scale-[0.95] transition-transform"
            >
              ×
            </button>
            <p className="pr-8 font-display text-lg font-bold text-text">Installer l'application</p>
            {platform === 'ios' ? (
              <div className="mt-3 space-y-2 text-left text-sm text-text-muted">
                <p>1. Touchez l'icône de partage (le carré avec une flèche vers le haut) en bas de Safari.</p>
                <p>2. Faites défiler puis touchez « Sur l'écran d'accueil ».</p>
                <p>3. Touchez « Ajouter » en haut à droite.</p>
              </div>
            ) : mustUseChrome ? (
              <div className="mt-3 space-y-2 text-left text-sm text-text-muted" data-testid="install-help-android-other">
                <p>
                  Sur Android, installez l'application <strong className="text-text">avec Google Chrome</strong>.
                  Depuis {browserLabel}, Google Play Protect la bloque (« Appli non sécurisée bloquée ») : ce
                  n'est pas un virus, ce navigateur fabrique une version trop ancienne.
                </p>
                <p>
                  Si une icône « Check-in » bloquée est déjà sur votre écran d'accueil, supprimez-la d'abord.
                </p>
                <button type="button" className="btn-primary mt-2 w-full" onClick={openInChrome}>
                  Ouvrir dans Chrome
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-2 text-left text-sm text-text-muted">
                {arrivedFromHandoff && deferredPrompt ? (
                  <p>Vous êtes dans Chrome : touchez « Installer » ci-dessous.</p>
                ) : (
                  <p>
                    Ouvrez le menu de votre navigateur (⋮ ou …) puis choisissez « Installer l'application » ou
                    « Ajouter à l'écran d'accueil ».
                  </p>
                )}
                {deferredPrompt && (
                  <button
                    type="button"
                    className="btn-primary mt-2 w-full"
                    onClick={async () => {
                      await runNativePrompt();
                      dismissHelp();
                    }}
                  >
                    Installer
                  </button>
                )}
              </div>
            )}
            <button className="btn-secondary mt-5 w-full" onClick={dismissHelp}>
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}
