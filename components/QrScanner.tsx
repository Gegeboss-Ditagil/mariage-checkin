'use client';

import { useEffect, useId, useRef, useState } from 'react';

type ScannerErrorKind = 'denied' | 'not_found' | 'in_use' | 'unknown';

// Classe l'erreur brute (souvent une exception getUserMedia enveloppee par
// html5-qrcode) pour donner un message actionnable plutot qu'un message
// generique — la cause la plus frequente est une autorisation refusee.
function classifyError(err: unknown): ScannerErrorKind {
  const name = (err as { name?: string } | undefined)?.name || '';
  const text = String(err || '').toLowerCase();

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || text.includes('permission')) {
    return 'denied';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'not_found';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'in_use';
  }
  return 'unknown';
}

const ERROR_MESSAGES: Record<ScannerErrorKind, string> = {
  denied:
    "Autorisation caméra refusée. Ouvrez les réglages du site (icône cadenas ou (i) a cote de l'adresse), autorisez la caméra pour ce site, puis appuyez sur Réessayer.",
  not_found: 'Aucune caméra détectée sur cet appareil.',
  in_use: 'La caméra est déjà utilisée par une autre application. Fermez-la puis réessayez.',
  unknown: "Impossible d'accéder à la caméra. Vérifiez les autorisations puis réessayez.",
};

/**
 * Scanner QR via la camera, base sur html5-qrcode (fonctionne dans Safari iOS
 * en PWA/HTTPS). Appelle onScan() a chaque code detecte — le parent est
 * responsable du debounce/anti-doublon si besoin. En cas d'echec (le plus
 * souvent une autorisation refusee), un bouton "Reessayer" relance la
 * demande sans avoir a recharger toute la page.
 */
export function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const elementId = 'qr-scanner-' + useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const [error, setError] = useState<ScannerErrorKind | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const lastScanRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setError(null);
      const { Html5Qrcode } = await import('html5-qrcode');
      if (cancelled || !containerRef.current) return;

      const scanner = new Html5Qrcode(elementId, { verbose: false });
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText) => {
            const now = Date.now();
            // Anti-doublon : ignore le meme code scanne deux fois en < 2s
            if (decodedText === lastScanRef.current.text && now - lastScanRef.current.at < 2000) {
              return;
            }
            lastScanRef.current = { text: decodedText, at: now };
            onScan(decodedText);
          },
          () => {
            // erreur de decodage par frame — ignorer silencieusement
          }
        );
        // start() peut finir après le démontage lors d'un retour très rapide.
        // Dans ce cas, arrêter immédiatement le flux nouvellement ouvert.
        if (cancelled && scanner.isScanning) {
          try {
            await scanner.stop();
            scanner.clear();
          } catch {
            // Le navigateur a déjà libéré la caméra.
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(classifyError(err));
      }
    }

    start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner) return;
      // html5-qrcode peut lever synchroniquement si la navigation démonte le
      // composant pendant start(), avant que la caméra soit effectivement en
      // marche. Vérifier l'état et envelopper aussi l'appel synchrone évite
      // l'exception client lors de clics rapides entre Scan/Plan/Retour.
      try {
        if (scanner.isScanning) {
          void scanner.stop().then(() => scanner.clear()).catch(() => {});
        } else {
          scanner.clear();
        }
      } catch {
        // Le composant est déjà démonté : aucune action restante nécessaire.
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementId, retryKey]);

  return (
    <div className="overflow-hidden rounded-xl2 bg-black">
      {/* Ratio 3/2 (plutot que carre) : demande de Gersom le 23/08/2026,
          pour que /scan tienne entierement sur un ecran sans defiler --
          html5-qrcode dimensionne la video sur ce conteneur, quel que soit
          son ratio, le scan reste fonctionnel. */}
      <div id={elementId} ref={containerRef} className="aspect-[3/2] w-full" />
      {error && (
        <div className="space-y-3 p-4 text-center">
          <p className="text-sm text-white">{ERROR_MESSAGES[error]}</p>
          <button type="button" onClick={() => setRetryKey((k) => k + 1)} className="btn-secondary w-full">
            Réessayer
          </button>
        </div>
      )}
    </div>
  );
}
