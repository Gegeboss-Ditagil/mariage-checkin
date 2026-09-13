'use client';

import { useEffect, useRef, useState } from 'react';

type CameraErrorKind = 'denied' | 'not_found' | 'in_use' | 'unknown';

// Meme classification d'erreur que QrScanner.tsx (memes exceptions
// getUserMedia possibles), duplique volontairement ici plutot que factorise :
// QrScanner encapsule aussi le cycle de vie html5-qrcode (scan QR), pas
// seulement l'acces camera -- les deux composants n'ont plus qu'une petite
// partie en commun.
function classifyError(err: unknown): CameraErrorKind {
  const name = (err as { name?: string } | undefined)?.name || '';
  const text = String(err || '').toLowerCase();
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || text.includes('permission')) return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'not_found';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'in_use';
  return 'unknown';
}

const ERROR_MESSAGES: Record<CameraErrorKind, string> = {
  denied:
    "Autorisation caméra refusée. Ouvrez les réglages du site (icône cadenas ou (i) à côté de l'adresse), autorisez la caméra pour ce site, puis appuyez sur Réessayer.",
  not_found: 'Aucune caméra détectée sur cet appareil.',
  in_use: 'La caméra est déjà utilisée par une autre application. Fermez-la puis réessayez.',
  unknown: "Impossible d'accéder à la caméra. Vérifiez les autorisations puis réessayez.",
};

/**
 * Camera en direct pour prendre UNE photo sans jamais quitter l'application
 * -- demande de Gersom le 13/09/2026 : "je remarque que ça quitte
 * l'appareil photo, ça va vers l'application iPhone d'appareil photo...
 * on aurait voulu un système vraiment un peu comme la page scanner
 * directement". Remplace un `<input type="file" capture="environment">`
 * (qui ouvre l'app Camera native sur iOS/Android) par un flux vidéo en
 * direct (getUserMedia) + capture d'une frame sur canvas, exactement le même
 * mecanisme que `QrScannerHandle.captureFrame()` utilisé sur /scan -- mais
 * sans le decodage QR de html5-qrcode, inutile ici (une simple photo).
 */
export function PhotoCaptureCamera({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<CameraErrorKind | null>(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setReady(false);

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        if (!cancelled) setReady(true);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(classifyError(err));
      }
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [retryKey]);

  function capture() {
    const video = videoRef.current;
    if (!video || !ready || !video.videoWidth || !video.videoHeight) return;
    setCapturing(true);
    const canvas = document.createElement('canvas');
    // Meme reduction que QrScanner.captureFrame : inutile d'envoyer une frame
    // 4K pour reconnaitre une personne dans la fiche d'approbation.
    const maxDimension = 1280;
    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      setCapturing(false);
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        setCapturing(false);
        if (!blob) return;
        onCapture(new File([blob], `invite-surprise-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.8
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black safe-top safe-bottom">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-display text-lg text-white">Prendre la photo</p>
        <button type="button" onClick={onClose} className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white">
          Annuler
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">Ouverture de la caméra…</div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center">
            <p className="text-sm text-white">{ERROR_MESSAGES[error]}</p>
            <button type="button" onClick={() => setRetryKey((k) => k + 1)} className="btn-secondary w-full max-w-xs">
              Réessayer
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center px-4 py-6">
        <button
          type="button"
          aria-label="Prendre la photo"
          disabled={!ready || capturing}
          onClick={capture}
          className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 transition-transform active:scale-90 disabled:opacity-40"
        >
          <span className="h-16 w-16 rounded-full bg-white" />
        </button>
      </div>
    </div>
  );
}
