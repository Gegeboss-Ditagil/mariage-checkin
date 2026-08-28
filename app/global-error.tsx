'use client';

import { useEffect } from 'react';

/**
 * Filet de secours ultime (Next.js App Router) : `app/error.tsx` ne
 * rattrape que les erreurs sous le layout racine -- une erreur dans
 * `app/layout.tsx` lui-meme (police, provider, etc.) le contourne
 * completement et laisse une page blanche irrecuperable sans ce fichier.
 * `global-error.tsx` remplace TOUT le layout racine quand il se declenche,
 * donc il doit fournir son propre <html>/<body> et eviter toute dependance
 * qui pourrait elle-meme planter (styles minimaux en ligne plutot que
 * Tailwind, au cas ou le CSS global soit justement la cause du crash).
 *
 * Meme strategie de recuperation que app/error.tsx : la cause la plus
 * frequente d'un crash generalise ici est une session/version incompatible
 * apres un deploiement -- on nettoie et renvoie vers /login plutot que de
 * laisser 20 personnes bloquees sur un ecran blanc le jour J.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    let cancelled = false;

    async function recover() {
      try {
        await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' });
      } catch {
        // Le middleware nettoiera de toute facon la session au prochain acces.
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
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            display: 'flex',
            minHeight: '100dvh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: '0 24px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Mise à jour de l'application</p>
          <p style={{ maxWidth: 360, fontSize: 14, color: '#555', margin: 0 }}>
            Une nouvelle version est disponible. Votre session est en cours de réinitialisation pour éviter une
            erreur d'affichage.
          </p>
          <button
            style={{
              marginTop: 8,
              padding: '10px 20px',
              borderRadius: 999,
              border: 'none',
              background: '#0c1912',
              color: '#fff',
              fontWeight: 600,
            }}
            onClick={() => window.location.replace('/login?reason=update')}
          >
            Se reconnecter
          </button>
          <button
            style={{ fontSize: 12, color: '#999', background: 'none', border: 'none', textDecoration: 'underline' }}
            onClick={reset}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
