// v1.71.1 -- réseau faible sur place (demande de Gersom : « connectivité
// peut-être réduite... je ne veux pas de flash »). Pendant une View
// Transition, le navigateur FIGE l'ancien écran jusqu'à ce que la nouvelle
// page soit prête ; si elle tarde (~4 s, réseau saturé), il abandonne avec
// « View transition update callback timed out » -- écran gelé puis saut
// brutal. Erreur relevée à répétition dans app_logs depuis v1.62.0, y compris
// sur l'iPhone de Gersom, jamais résolue jusqu'ici.
//
// next-view-transitions teste `'startViewTransition' in document` à CHAQUE
// navigation et retombe sur une navigation normale sinon : retirer cette
// méthode du prototype suffit à désactiver proprement les transitions, sans
// toucher au routage. Désactivation pour la session (sessionStorage) :
//   * dès qu'une transition a expiré une fois (le réseau est lent ici) ;
//   * d'emblée si le navigateur annonce une connexion lente ou « économie de
//     données » (Chrome/Android ; iOS n'expose pas cette information).
// Le même code tourne en script synchrone dans <head> (app/layout.tsx) pour
// s'appliquer avant l'hydratation, d'où la chaîne VIEW_TRANSITION_GUARD_SCRIPT.

export const VIEW_TRANSITION_OFF_KEY = 'checkin-vt-off';

export function isViewTransitionTimeout(message: string | undefined | null): boolean {
  return !!message && /View transition update callback timed out/i.test(message);
}

export function disableViewTransitions(remember: boolean): void {
  try {
    if (remember) sessionStorage.setItem(VIEW_TRANSITION_OFF_KEY, '1');
  } catch {
    // Navigation privée / stockage bloqué : la désactivation vaut pour la page.
  }
  try {
    delete (Document.prototype as unknown as Record<string, unknown>).startViewTransition;
  } catch {
    // Propriété non configurable sur un navigateur exotique : sans effet.
  }
}

export const VIEW_TRANSITION_GUARD_SCRIPT =
  "try{var c=navigator.connection;var slow=c&&(c.saveData||/(^|-)2g$|^3g$/.test(c.effectiveType||''));" +
  `if(sessionStorage.getItem('${VIEW_TRANSITION_OFF_KEY}')==='1'||slow){delete Document.prototype.startViewTransition;}}catch(e){}`;
