'use client';

import { useRef, useState } from 'react';
import { FloorPlan } from '@/components/FloorPlan';

// Enrobe FloorPlan (le SVG lui-meme reste inchange) avec un zoom/pan tactile.
// Demande de Gersom le 23/08/2026 : le plan est trop petit pour distinguer
// les tables d'un coup d'oeil quand on veut appeler quelqu'un rapidement --
// permettre de zoomer avec un geste de pincement (deux doigts), comme sur
// une carte, plus des boutons +/- pour la souris/le clavier (admin sur
// ordinateur, ou appareils sans ecran tactile).
//
// Implementation en Pointer Events (pas de librairie externe) : jusqu'a deux
// pointeurs actifs suivis dans une ref (pas de re-render a chaque pixel).
// Pincement -> zoom autour du centre du cadre; un seul doigt une fois zoome
// -> deplacement (pan), toujours borne pour ne jamais laisser le plan partir
// hors du cadre. `touch-action: none` sur le cadre desactive le zoom natif
// du navigateur ici (qui zoomerait toute la page) pour laisser le geste au
// composant. Un mouvement au-dela d'un seuil supprime le clic de selection
// de table qui suit normalement un appui (onClickCapture) : sinon relacher
// un pincement ou un glissement sur une table la selectionnerait par
// accident.
const MIN_SCALE = 1;
const MAX_SCALE = 3;

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

interface Point {
  x: number;
  y: number;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

interface ZoomableFloorPlanProps {
  selectedNumber: number | null;
  onSelectNumber: (number: number) => void;
  occupied?: Set<number>;
}

export function ZoomableFloorPlan({ selectedNumber, onSelectNumber, occupied }: ZoomableFloorPlanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointers = useRef<Map<number, Point>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; translate: Point } | null>(null);
  const moved = useRef(false);

  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState<Point>({ x: 0, y: 0 });

  function clampTranslate(desired: Point, atScale: number): Point {
    const el = containerRef.current;
    if (!el) return desired;
    const rect = el.getBoundingClientRect();
    const maxX = Math.max(0, (rect.width * (atScale - 1)) / 2);
    const maxY = Math.max(0, (rect.height * (atScale - 1)) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, desired.x)),
      y: Math.min(maxY, Math.max(-maxY, desired.y)),
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Un nouveau geste repart proprement. Le clic synthétique du geste
    // précédent, s'il existe, a déjà été capturé avant ce nouveau pointerdown;
    // s'il n'existait pas (fréquent après un pincement), on évite ainsi
    // d'avaler le prochain vrai tap sur une table.
    if (pointers.current.size === 0) moved.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      // Deux pointeurs peuvent exceptionnellement commencer au même pixel;
      // une borne minimale évite alors une division par zéro au mouvement.
      pinchStart.current = { dist: Math.max(1, distance(a, b)), scale };
      panStart.current = null;
    } else if (pointers.current.size === 1) {
      panStart.current = { x: e.clientX, y: e.clientY, translate };
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = Array.from(pointers.current.values());
      const ratio = distance(a, b) / pinchStart.current.dist;
      const nextScale = clampScale(pinchStart.current.scale * ratio);
      moved.current = true;
      setScale(nextScale);
      setTranslate((t) => clampTranslate(t, nextScale));
    } else if (pointers.current.size === 1 && panStart.current && scale > 1) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
      setTranslate(
        clampTranslate({ x: panStart.current.translate.x + dx, y: panStart.current.translate.y + dy }, scale)
      );
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 1) {
      // Un doigt reste apres un pincement a deux doigts : on redemarre la
      // reference de glissement depuis sa position actuelle, sinon le plan
      // sauterait au prochain mouvement.
      const remaining = Array.from(pointers.current.values())[0];
      panStart.current = { x: remaining.x, y: remaining.y, translate };
    } else if (pointers.current.size === 0) {
      panStart.current = null;
    }
  }

  function onClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (moved.current) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
    }
  }

  function zoomBy(factor: number) {
    setScale((s) => {
      const next = clampScale(s * factor);
      setTranslate((t) => clampTranslate(t, next));
      return next;
    });
  }

  function resetZoom() {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="touch-none select-none overflow-hidden rounded-xl2"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        onDoubleClick={resetZoom}
      >
        <div
          style={{
            transform: 'translate(' + translate.x + 'px, ' + translate.y + 'px) scale(' + scale + ')',
            transformOrigin: 'center center',
            transition: pointers.current.size === 0 ? 'transform 150ms ease-out' : 'none',
          }}
        >
          <FloorPlan selectedNumber={selectedNumber} onSelectNumber={onSelectNumber} occupied={occupied} />
        </div>
      </div>

      {/* Boutons +/- : au clavier/souris (admin sur ordinateur) en plus du
          pincement tactile, et un rappel visuel que le plan se zoome. */}
      <div className="absolute bottom-2 right-2 flex flex-col gap-1.5">
        <button
          type="button"
          aria-label="Zoomer sur le plan de salle"
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gold-400/40 bg-white text-xl font-bold leading-none text-gold-700 shadow"
          onClick={() => zoomBy(1.4)}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Dézoomer sur le plan de salle"
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gold-400/40 bg-white text-xl font-bold leading-none text-gold-700 shadow"
          onClick={() => zoomBy(1 / 1.4)}
        >
          −
        </button>
        {scale > 1 && (
          <button
            type="button"
            aria-label="Réinitialiser le zoom du plan de salle"
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gold-400/40 bg-white text-sm font-bold leading-none text-gold-700 shadow"
            onClick={resetZoom}
          >
            ↺
          </button>
        )}
      </div>
    </div>
  );
}
