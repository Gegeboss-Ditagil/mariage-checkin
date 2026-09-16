'use client';

import { useRef, useState } from 'react';
import { TrashIcon } from '@/components/icons';

// v1.53.2 : premiere tentative (verrouillage d'axe -- ne capturer le
// pointeur qu'une fois le geste tranche horizontal/vertical) pour un bug
// signale par Gersom sur iOS ("je ne peux pas swipe left or right"). Confirme
// insuffisant par un second test reel : aucune reaction au glissement, meme
// partielle -- le defilement vertical natif fonctionnait, mais aucun
// pointermove horizontal exploitable n'atteignait jamais React.
//
// v1.53.4 : cause probable identifiee -- sur iOS Safari, NE PAS capturer le
// pointeur des pointerdown laisse le moteur natif trancher seul le sens du
// geste avant que le JS ait pu observer assez de mouvement pour justifier
// une capture tardive ; avec `touch-action: pan-y`, WebKit tranche alors
// presque systematiquement pour un defilement vertical natif, et plus aucun
// pointermove utile n'est jamais delivre au gestionnaire React. Nouvelle
// approche conforme a la specification touch-action/Pointer Events (utilisee
// par la plupart des bibliotheques de glissement) : capturer le pointeur
// IMMEDIATEMENT a pointerdown, laisser pointermove suivre tout deplacement
// horizontal, et compter sur le navigateur pour annuler la sequence
// (pointercancel) des qu'il detecte lui-meme un defilement vertical
// dominant -- `touch-action: pan-y` garantit que ce defilement natif reste
// possible meme apres capture, et `onPointerCancel` reinitialise proprement
// l'etat de glissement des que cela arrive.
const DELETE_THRESHOLD = 120;
const MAX_DRAG = 220;
const VERTICAL_INTENT_THRESHOLD = 10;

export function SwipeableDeleteCard({
  enabled,
  onDelete,
  children,
}: {
  enabled: boolean;
  onDelete: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  const [dragX, setDragX] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);
  const verticalIntent = useRef(false);

  if (!enabled) return <>{children}</>;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (deleting) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    dragging.current = true;
    verticalIntent.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current || startX.current === null || startY.current === null) return;
    const deltaX = e.clientX - startX.current;
    const deltaY = e.clientY - startY.current;

    if (!verticalIntent.current && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > VERTICAL_INTENT_THRESHOLD) {
      verticalIntent.current = true;
    }
    if (verticalIntent.current) return;

    setDragX(Math.max(-MAX_DRAG, Math.min(0, deltaX)));
  }

  function onPointerUp() {
    const wasVerticalIntent = verticalIntent.current;
    dragging.current = false;
    startX.current = null;
    startY.current = null;
    verticalIntent.current = false;
    if (!wasVerticalIntent && -dragX >= DELETE_THRESHOLD) {
      setDeleting(true);
      setDragX(-MAX_DRAG);
      void Promise.resolve(onDelete());
    } else {
      setDragX(0);
    }
  }

  const revealRatio = Math.min(1, -dragX / DELETE_THRESHOLD);

  return (
    <div className="relative overflow-hidden rounded-xl2">
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-end bg-status-over pr-6 text-white"
        style={{ opacity: revealRatio }}
      >
        <TrashIcon className="h-6 w-6" />
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: 'translateX(' + dragX + 'px)',
          transition: dragging.current ? 'none' : 'transform 200ms ease-out, opacity 200ms ease-out',
          opacity: deleting ? 0 : 1,
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}
