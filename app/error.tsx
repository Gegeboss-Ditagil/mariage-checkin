'use client';

import { useEffect } from 'react';

// Une erreur non capturee QUELQUE PART dans l'app (n'importe quel composant,
// n'importe quelle page) remonte ici -- c'est le filet generique de Next.js.
// Avant le 17/09/2026, TOUTE erreur -- vraie erreur de bundle perime apres un
// deploiement, mais aussi n'importe quel bug de rendu sans aucun rapport
// (ex: v1.33.1, un spread sur `undefined` plantait `/agenda`) -- deconnectait
// immediatement l'utilisateur et le renvoyait au login, quelle que soit la
// cause reelle. Documente comme correctif ponctuel a l'epoque ("d'ou
// l'impression de deconnexions frequentes apres quelques manipulations"),
// jamais corrige a la racine : un bug de rendu completement independant de
// la session forcait quand meme une deconnexion. Seule une vraie erreur de
// chunk/module perime (le cas qui justifie reellement une reconnexion, car
// le JS charge ne correspond plus au HTML servi par le nouveau deploiement)
// doit desormais forcer une reconnexion -- toute autre erreur affiche un
// ecran recuperable (Reessayer) sans jamais toucher a la session.
function isStaleDeploymentError(error: Error & { digest?: string }): boolean {
  if (error.name === 'ChunkLoadError') return true;
  const message = error.message || '';
  return (
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  );
}

async function reconnect() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' });
  } catch {
    // Meme si le logout reseau echoue, le rechargement vers /login permet
    // au middleware de revalider/nettoyer la session au prochain acces.
  }
  window.location.replace('/login?reason=update');
}

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const staleDeployment = isStaleDeploymentError(error);

  useEffect(() => {
    if (staleDeployment) void reconnect();
  }, [staleDeployment]);

  if (staleDeployment) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-2xl font-semibold">Mise à jour de l'application</p>
        <p className="max-w-sm text-sm text-text-muted">
          Une nouvelle version est disponible. Votre session est en cours de réinitialisation pour éviter une erreur d'affichage.
        </p>
        <button className="btn-primary mt-2" onClick={() => void reconnect()}>
          Se reconnecter
        </button>
      </div>
    );
  }

  // Erreur sans rapport avec un deploiement perime -- jamais de deconnexion
  // forcee, jamais de fetch reseau : "Reessayer" relance simplement le rendu
  // (`reset`, l'API standard des error boundaries Next.js App Router). Un
  // bouton de secours reste disponible si l'erreur revient malgre tout.
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-2xl font-semibold">Un problème est survenu</p>
      <p className="max-w-sm text-sm text-text-muted">
        Cette page a rencontré une erreur inattendue. Votre session reste active — vous pouvez réessayer.
      </p>
      <button className="btn-primary mt-2" onClick={reset}>
        Réessayer
      </button>
      <button className="text-xs text-text-faint underline" onClick={() => void reconnect()}>
        Se reconnecter à la place
      </button>
    </div>
  );
}
