'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Scanner QR via la camera, base sur html5-qrcode (fonctionne dans Safari iOS
 * en PWA/HTTPS). Appelle onScan() a chaque code detecte — le parent est
 * responsable du debounce/anti-doublon si besoin.
 */
export function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastScanRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (cancelled || !containerRef.current) return;

      const elementId = 'qr-scanner-viewport';
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
      } catch (err) {
        console.error(err);
        setError("Impossible d'accéder à la caméra. Vérifiez les autorisations.");
      }
    }

    start();

    return () => {
      cancelled = true;
      scannerRef.current
        ?.stop()
        .then(() => scannerRef.current?.clear())
        .catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="overflow-hidden rounded-xl2 bg-black">
      <div id="qr-scanner-viewport" ref={containerRef} className="aspect-square w-full" />
      {error && <p className="p-4 text-center text-sm text-white">{error}</p>}
    </div>
  );
}
