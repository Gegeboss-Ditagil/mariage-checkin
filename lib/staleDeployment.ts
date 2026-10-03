'use client';

// Detection + recuperation d'une vraie erreur de bundle perime apres un
// deploiement (le JS charge ne correspond plus au HTML/aux chunks servis par
// la version actuellement deployee) -- extrait de app/error.tsx (v1.53.19)
// pour etre reutilise aussi par components/GlobalErrorLogger.tsx (v1.58.0) :
// une erreur de ce type survenant dans un callback async (ex: la mise a jour
// de route sous-jacente a un `document.startViewTransition`, voir
// next-view-transitions) ne remonte JAMAIS a un error boundary React
// (app/error.tsx) -- elle n'apparait que comme `unhandledrejection`/
// `window.onerror`, que seul GlobalErrorLogger ecoute. Avant ce correctif,
// ce chemin se contentait de journaliser l'erreur sans jamais forcer la
// reconnexion que ce meme type d'erreur declenche deja depuis un rendu --
// l'app restait sur un bundle perime, sans jamais redemander de connexion,
// jusqu'au prochain rendu qui echoue "pour de vrai".
export function isStaleDeploymentError(error: { name?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  const message = error.message || '';
  return (
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  );
}

export async function reconnectAfterStaleDeployment() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' });
  } catch {
    // Meme si le logout reseau echoue, la redirection vers /login permet au
    // middleware de revalider/nettoyer la session au prochain acces.
  }
  window.location.replace('/login?reason=update');
}
