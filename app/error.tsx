'use client';

import { useEffect } from 'react';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    let cancelled = false;

    async function recover() {
      try {
        await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' });
      } catch {
        // Meme si le logout reseau echoue, le rechargement vers /login permet
        // au middleware de revalider/nettoyer la session au prochain acces.
      }

      if (!cancelled) {
        window.location.replace('/login?reason=update');
      }
    }

    recover();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-2xl font-semibold">Mise à jour de l'application</p>
      <p className="max-w-sm text-sm text-black/60">
        Une nouvelle version est disponible. Votre session est en cours de réinitialisation pour éviter une erreur d'affichage.
      </p>
      <button
        className="btn-primary mt-2"
        onClick={() => {
          window.location.replace('/login?reason=update');
        }}
      >
        Se reconnecter
      </button>
      <button className="text-xs text-black/40 underline" onClick={reset}>
        Réessayer cette page
      </button>
    </div>
  );
}
