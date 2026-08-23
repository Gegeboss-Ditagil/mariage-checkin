'use client';

import clsx from 'clsx';

// Coordonnees du plan de la salle, redessinees a la main a partir du plan
// papier fourni par Gersom le 23/08/2026 (schema simplifie -- pas une trace
// pixel par pixel de la photo, que l'app ne peut pas embarquer). Systeme de
// coordonnees SVG propre a ce composant, en unites arbitraires (viewBox
// 0 0 1400 1080), sans rapport avec les coordonnees Supabase.
//
// La table 41 (reserve) n'a volontairement PAS de position ici : son
// emplacement physique n'est pas encore defini (a ajouter plus tard, voir
// Gersom le 23/08/2026). Elle reste geree normalement dans la liste
// classique sous ce plan.
export const FLOOR_PLAN_TABLE_POSITIONS: Record<number, [number, number]> = {
  // Bloc "Tables amis" (22-40), 4 rangees x 5 colonnes (derniere rangee
  // incomplete, 4 tables).
  22: [695, 118], 28: [769, 118], 29: [843, 118], 36: [917, 118], 40: [991, 118],
  23: [695, 210], 27: [769, 210], 30: [843, 210], 35: [917, 210], 39: [991, 210],
  24: [695, 302], 26: [769, 302], 31: [843, 302], 34: [917, 302], 38: [991, 302],
  25: [695, 394], 32: [769, 394], 33: [843, 394], 37: [917, 394],
  // Bloc "familles" (1-21), 5 rangees x 5 colonnes (premiere et derniere
  // rangee incompletes).
  6: [769, 610], 13: [843, 610], 14: [917, 610], 21: [991, 610],
  5: [695, 690], 7: [769, 690], 12: [843, 690], 15: [917, 690], 20: [991, 690],
  4: [695, 770], 8: [769, 770], 11: [843, 770], 16: [917, 770], 19: [991, 770],
  3: [695, 850], 9: [769, 850], 10: [843, 850], 17: [917, 850], 18: [991, 850],
  1: [695, 930], 2: [769, 930],
};

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  // Etiquette pivotee a 90 deg : pour les couloirs/colonnes trop etroits
  // pour un texte horizontal (ex. "Couloir Est", 45 unites de large) --
  // sans ca le texte deborde sur les pieces voisines.
  vertical?: boolean;
}

const ROOMS: Room[] = [
  { x: 10, y: 20, w: 220, h: 320, label: 'Cuisine' },
  { x: 240, y: 20, w: 180, h: 90, label: 'CF' },
  { x: 240, y: 115, w: 180, h: 105, label: 'WCH' },
  { x: 240, y: 225, w: 180, h: 115, label: 'WCF' },
  { x: 150, y: 345, w: 270, h: 75, label: 'Bar' },
  { x: 10, y: 425, w: 240, h: 560, label: 'Stockage' },
  { x: 260, y: 425, w: 100, h: 250, label: 'Les mariés', vertical: true },
  { x: 260, y: 680, w: 100, h: 305, label: 'DJ et animation', vertical: true },
  { x: 370, y: 425, w: 240, h: 560, label: 'Piste de danse' },
  { x: 610, y: 425, w: 420, h: 90, label: 'Allée centrale' },
  { x: 630, y: 20, w: 400, h: 60, label: 'Couloir Nord' },
  { x: 440, y: 950, w: 590, h: 55, label: 'Couloir Sud' },
  { x: 1030, y: 20, w: 45, h: 940, label: 'Couloir Est', vertical: true },
  { x: 1085, y: 20, w: 300, h: 60, label: 'Buffet A' },
  { x: 1085, y: 90, w: 300, h: 60, label: 'Buffet B' },
  { x: 1055, y: 160, w: 335, h: 130, label: 'Espace discours', sub: 'Orateur · Les mariés' },
  { x: 1055, y: 300, w: 130, h: 280, label: 'Invités' },
  { x: 1260, y: 300, w: 130, h: 280, label: 'Invités' },
  { x: 1055, y: 600, w: 335, h: 340, label: "Vin d'honneur" },
];

interface FloorPlanProps {
  selectedNumber: number | null;
  onSelectNumber: (number: number) => void;
  occupied?: Set<number>;
}

export function FloorPlan({ selectedNumber, onSelectNumber, occupied }: FloorPlanProps) {
  return (
    <svg
      viewBox="0 0 1400 1080"
      className="h-auto w-full select-none rounded-xl2 border-2 border-gold-300/30 bg-cream"
      role="img"
      aria-label="Plan interactif de la salle : appuyez sur une table pour la sélectionner"
    >
      {ROOMS.map((room, idx) => (
        <g key={idx}>
          <rect
            x={room.x}
            y={room.y}
            width={room.w}
            height={room.h}
            rx={6}
            className="fill-black/[0.04] stroke-black/15"
            strokeWidth={1.5}
          />
          <text
            x={room.x + room.w / 2}
            y={room.y + room.h / 2 - (room.sub ? 8 : 0)}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={
              room.vertical
                ? 'rotate(-90 ' + (room.x + room.w / 2) + ' ' + (room.y + room.h / 2) + ')'
                : undefined
            }
            className="fill-black/45 text-[13px] font-semibold uppercase tracking-wide"
          >
            {room.label}
          </text>
          {room.sub && (
            <text
              x={room.x + room.w / 2}
              y={room.y + room.h / 2 + 14}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-black/35 text-[10px]"
            >
              {room.sub}
            </text>
          )}
        </g>
      ))}

      {Object.entries(FLOOR_PLAN_TABLE_POSITIONS).map(([numStr, [x, y]]) => {
        const number = Number(numStr);
        const selected = selectedNumber === number;
        const hasGuests = occupied?.has(number);
        return (
          <g
            key={number}
            className="cursor-pointer focus:outline-none"
            onClick={() => onSelectNumber(number)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectNumber(number);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={'Table ' + number}
          >
            {/* Zone de contact plus large que le cercle visible, pour rester
                facile a toucher sur mobile (cible tactile ~44px minimum). */}
            <circle cx={x} cy={y} r={34} fill="transparent" />
            {selected && (
              <circle cx={x} cy={y} r={31} className="fill-status-complete/20 stroke-status-complete" strokeWidth={4} />
            )}
            <circle
              cx={x}
              cy={y}
              r={26}
              className={clsx(
                'stroke-2',
                selected ? 'fill-status-complete stroke-status-complete' : 'fill-white stroke-gold-500',
                !selected && hasGuests && 'stroke-[3]'
              )}
            />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className={clsx('text-[15px] font-bold', selected ? 'fill-white' : 'fill-ink')}
            >
              {number}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
