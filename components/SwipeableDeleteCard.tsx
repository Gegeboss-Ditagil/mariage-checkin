'use client';

import { useRef, useState } from 'react';
import { TrashIcon } from '@/components/icons';

// Swipe pour supprimer, réservé à l'admin -- demande de Gersom le
// 13/09/2026 : "il y a beaucoup de refusé maintenant, la liste va
// s'étendre. Les administrateurs ont le droit de faire un swipe pour les
// effacer... quand tu tires, il y a la petite poubelle qui va apparaître
// avec le champ rouge... et quand tu continues à tirer, ça les efface
// vraiment." Implémenté en Pointer Events (pas de librairie externe),
// même approche que ZoomableFloorPlan.tsx : un fond rouge + icône poubelle
// apparaît derrière la carte au fur et à mesure du glissement vers la
// gauche, et un glissement complet (au-delà de DELETE_THRESHOLD) déclenche
// la suppression au relâchement.
const DELETE_THRESHOLD = 120;
const MAX_DRAG = 220;

export function SwipeableDeleteCard({
  enabled,
  onDelete,
  children,
}: {
  // Désactivé (non-admin, ou demande encore en_attente) : rend `children`
  // tel quel, sans aucune superposition ni gestionnaire de pointeur --
  // jamais de zone morte accidentelle pour les autres rôles.
  enabled: boolean;
  onDelete: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  const [dragX, setDragX] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);

  if (!enabled) return <>{children}</>;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (deleting) return;
    startX.current = e.clientX;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current || startX.current === null) return;
    const delta = e.clientX - startX.current;
    // Seul le glissement vers la gauche revele la poubelle -- vers la
    // droite, rien ne se passe (pas de sens a une suppression "inverse").
    setDragX(Math.max(-MAX_DRAG, Math.min(0, delta)));
  }

  function onPointerUp() {
    dragging.current = false;
    startX.current = null;
    if (-dragX >= DELETE_THRESHOLD) {
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
