// v1.48.4, demande de Gersom : "le petit 1 indicateur sur l'icône avant de
// l'ouvrir" -- badge numérique directement sur l'icône de l'app (écran
// d'accueil), visible AVANT même d'ouvrir l'app. Distinct du badge affiché
// à l'intérieur de l'app (AccountMenu/BottomNav/GuestApprovalsShortcut,
// visible uniquement une fois ouvert). Utilise la Badging API
// (`navigator.setAppBadge`/`clearAppBadge`), supportée par les PWA
// installées sur l'écran d'accueil depuis iOS 16.4 -- absente sur Safari en
// onglet normal et sur les navigateurs qui ne la supportent pas du tout :
// chaque appel est donc best-effort, jamais bloquant, jamais une erreur
// visible pour l'appelant.
//
// Deux chemins de mise à jour, volontairement redondants :
// - En tâche de fond, à la réception d'un Push (public/sw.js lit
//   `badgeCount` dans le payload envoyé par lib/webPush.ts) -- fonctionne
//   même si l'app n'est pas ouverte, c'est le scénario demandé ici.
// - En premier plan, à chaque sondage du compte d'approbations en attente
//   (AccountMenu/BottomNav/GuestApprovalsShortcut, même valeur
//   `pending_count`) -- recale/efface le badge dès que l'app est rouverte,
//   sans attendre un futur Push.
type NavigatorWithBadge = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function syncAppBadge(count: number): void {
  if (typeof navigator === 'undefined') return;
  const nav = navigator as NavigatorWithBadge;
  if (!nav.setAppBadge || !nav.clearAppBadge) return;
  try {
    const result = count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge();
    void result.catch(() => {
      // Best-effort -- l'absence de badge ne doit jamais bloquer l'appelant.
    });
  } catch {
    // Certains navigateurs peuvent lever de façon synchrone plutôt que
    // rejeter la promesse (ex. contexte non sécurisé) -- même filet.
  }
}

export function clearAppBadge(): void {
  syncAppBadge(0);
}
