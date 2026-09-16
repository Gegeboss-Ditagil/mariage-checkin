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
//
// v1.53.2, bug réel signalé par Gersom (16/09/2026) : "je n'ai toujours pas
// la possibilité de swipe" (rôle admin confirmé en base avant de chercher
// plus loin, voir docs/QE_QA_PROCESS.md). Root cause probable : le pointeur
// était capturé (`setPointerCapture`) DÈS `onPointerDown`, avant même de
// savoir si le geste allait être horizontal ou vertical -- sur WebKit/iOS,
// capturer un pointeur tactile aussi tôt, combiné à `touch-action: pan-y`
// (qui autorise le défilement vertical natif), peut faire annuler la
// séquence de pointeur presque immédiatement (le navigateur "gagne" le
// geste pour son propre défilement dès qu'il détecte la moindre composante
// verticale, même infime) -- l'utilisateur ne voit alors jamais rien se
// passer, quelle que soit l'intention de son geste. Corrigé en ne
// choisissant l'axe (et en ne capturant le pointeur) qu'une fois le
// mouvement assez net pour trancher : sous AXIS_LOCK_THRESHOLD, on attend ;
// au-delà, seul l'axe dominant gagne -- horizontal verrouille le geste
// (poubelle), vertical le relâche entièrement (défilement natif de la
// liste, jamais de conflit).
const DELETE_THRESHOLD = 120;
const MAX_DRAG = 220;
const AXIS_LOCK_THRESHOLD = 8;

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
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);
  // null tant que le mouvement est trop petit pour trancher ; 'horizontal'
  // une fois le geste reconnu comme un swipe (pointeur capturé, poubelle
  // active) ; 'vertical' si le doigt part plutôt haut/bas (on relâche alors
  // entièrement la main au défilement natif de la liste, sans jamais entrer
  // en conflit avec lui -- voir la note en tête de fichier).
  const axis = useRef<'horizontal' | 'vertical' | null>(null);

  if (!enabled) return <>{children}</>;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (deleting) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    dragging.current = true;
    axis.current = null;
    // Pas de setPointerCapture ici : tant que le geste n'est pas reconnu
    // comme horizontal (voir onPointerMove), le navigateur reste libre de
    // faire défiler la liste normalement si le doigt part plutôt à la
    // verticale -- capturer le pointeur trop tôt empêchait toute détection
    // du swipe sur iOS (voir la note en tête de fichier).
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current || startX.current === null || startY.current === null) return;
    const deltaX = e.clientX - startX.current;
    const deltaY = e.clientY - startY.current;

    if (axis.current === 'vertical') return; // défilement natif en cours, on ignore le reste du geste

    if (axis.current === null) {
      if (Math.abs(deltaX) < AXIS_LOCK_THRESHOLD && Math.abs(deltaY) < AXIS_LOCK_THRESHOLD) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        axis.current = 'vertical';
        dragging.current = false;
        return;
      }
      axis.current = 'horizontal';
      // Le pointeur n'est capturé qu'une fois le geste reconnu comme un
      // swipe horizontal -- jamais avant (voir onPointerDown).
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    // Seul le glissement vers la gauche revele la poubelle -- vers la
    // droite, rien ne se passe (pas de sens a une suppression "inverse").
    setDragX(Math.max(-MAX_DRAG, Math.min(0, deltaX)));
  }

  function onPointerUp() {
    const wasHorizontalSwipe = axis.current === 'horizontal';
    dragging.current = false;
    startX.current = null;
    startY.current = null;
    axis.current = null;
    if (wasHorizontalSwipe && -dragX >= DELETE_THRESHOLD) {
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
