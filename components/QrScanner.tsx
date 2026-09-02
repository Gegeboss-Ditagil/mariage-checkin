'use client';

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';

export interface QrScannerHandle {
  captureFrame: () => Promise<File>;
}

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
export const QrScanner = forwardRef<QrScannerHandle, { onScan: (text: string) => void }>(function QrScanner(
  { onScan },
  ref
) {
  const elementId = 'qr-scanner-' + useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const [error, setError] = useState<ScannerErrorKind | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const lastScanRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  useImperativeHandle(ref, () => ({
    async captureFrame() {
      const video = containerRef.current?.querySelector('video');
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
        throw new Error('camera_not_ready');
      }
      const canvas = document.createElement('canvas');
      // Une frame 4K d'iPhone est inutile pour reconnaitre une personne dans
      // la fiche d'approbation et prend plusieurs secondes a envoyer/charger.
      // 1280 px sur le plus grand cote garde une photo nette sur telephone et
      // iPad tout en divisant fortement son poids.
      const maxDimension = 1280;
      const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas_unavailable');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      if (!blob) throw new Error('capture_failed');
      return new File([blob], `invite-surprise-${Date.now()}.jpg`, { type: 'image/jpeg' });
    },
  }), []);

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
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
              return { width: size, height: size };
            },
          },
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
      {/* Hauteur pilotée par le viewport plutôt que par la largeur : le ratio
          3/2 historique écrasait la caméra à environ 360 px sur un grand
          iPhone et laissait la moitié de l'écran vide. clamp garde une zone
          utile sur iPhone SE, remplit les grands iPhone/Android/iPad sans
          devenir démesurée, et le parent peut toujours défiler au besoin.
          Pourcentage resserré le 02/09/2026 (55dvh -> 46dvh) pour laisser la
          place à NextAgendaActivity sur /scan sans avoir à scroller. */}
      <div
        id={elementId}
        ref={containerRef}
        className="h-[clamp(320px,46dvh,620px)] w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
      />
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
});
