'use client';

import clsx from 'clsx';

// Coordonnees du plan de la salle, redessinees a la main a partir des photos
// annotees fournies par Gersom (23/08/2026, puis mise a jour du 23/08/2026
// avec numerotation ajustee + nouvelles zones ; puis correctif du 24/08/2026
// sur l'emplacement des tables 34/35/36/37, confirme par Gersom apres
// relecture du rendu) -- schema simplifie, pas une trace pixel par pixel de
// la photo, que l'app ne peut pas embarquer.
// Systeme de coordonnees SVG propre a ce composant, en unites arbitraires
// (viewBox 0 0 1400 1080), sans rapport avec les coordonnees Supabase.
//
// La table 41 (reserve) a desormais une position definie ici (mise a jour
// du 23/08/2026, confirmee par Gersom) -- avant cette date elle n'apparaissait
// pas sur le plan, son emplacement physique n'etant pas encore fixe.
export const FLOOR_PLAN_TABLE_POSITIONS: Record<number, [number, number]> = {
  // Bloc "Tables amis" (22-41), reconstruit a partir de la photo annotee du
  // 23/08/2026 : une 6e colonne a ete ajoutee a gauche pour la table 41 :
  // approximation raisonnable a partir d'une photo annotee a la main, pas
  // une trace pixel par pixel -- a corriger si l'emplacement reel differe.
  22: [650, 118], 24: [718, 118], 29: [786, 118], 30: [855, 118], 37: [923, 118], 41: [991, 118],
  23: [650, 210], 25: [718, 210], 28: [786, 210], 31: [855, 210], 36: [923, 210], 40: [991, 210],
  26: [718, 302], 27: [786, 302], 32: [855, 302], 35: [923, 302], 39: [991, 302],
  33: [855, 394], 34: [923, 394], 38: [991, 394],
  // Bloc "familles" (1-21), inchange -- 5 rangees x 5 colonnes (premiere et
  // derniere rangee incompletes).
  6: [769, 610], 13: [843, 610], 14: [917, 610], 21: [991, 610],
  5: [695, 690], 7: [769, 690], 12: [843, 690], 15: [917, 690], 20: [991, 690],
  4: [695, 770], 8: [769, 770], 11: [843, 770], 16: [917, 770], 19: [991, 770],
  3: [695, 850], 9: [769, 850], 10: [843, 850], 17: [917, 850], 18: [991, 850],
  1: [695, 930], 2: [769, 930],
};

export interface Room {
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
  // Tag staff (deja present sur les invitations en base, voir lib/tags) --
  // present uniquement sur les zones cliquables. Cliquer la zone affiche le
  // personnel portant ce tag, sous le plan (voir app/plan-table/page.tsx).
  // Demande de Gersom le 23/08/2026 : DJ et animation, Cuisine (traiteur),
  // Bar et Prestataires/staff (photographe et autres) doivent pouvoir
  // s'ouvrir ainsi, sans dupliquer de liste de roles -- on reutilise les
  // tags deja poses lors de l'import CSV.
  staffTag?: string;
}

const ROOMS: Room[] = [
  { x: 10, y: 20, w: 220, h: 320, label: 'Cuisine', staffTag: 'Traiteur' },
  { x: 240, y: 20, w: 180, h: 90, label: 'CF' },
  { x: 240, y: 115, w: 180, h: 105, label: 'WCH' },
  { x: 240, y: 225, w: 180, h: 115, label: 'WCF' },
  { x: 150, y: 345, w: 270, h: 75, label: 'Bar', staffTag: 'Bar' },
  // Ancienne zone "Stockage" scindee en deux (photo annotee du 23/08/2026) :
  // une zone enfants (pas de personnel rattache, simple espace) et une zone
  // prestataires/staff cliquable (photographe et autres, tag Photographe).
  { x: 10, y: 425, w: 240, h: 280, label: 'Zone enfants' },
  {
    x: 10,
    y: 705,
    w: 240,
    h: 280,
    label: 'Prestataires & staff',
    sub: 'Photographe et autres',
    staffTag: 'Photographe',
  },
  { x: 260, y: 425, w: 100, h: 250, label: 'Les mariés', vertical: true },
  { x: 260, y: 680, w: 100, h: 305, label: 'DJ et animation', vertical: true, staffTag: 'DJ_Animation' },
  // Ancienne zone "Piste de danse" scindee en deux (photo annotee du
  // 23/08/2026) : la piste retrecit et une zone "Stage band & chanteurs"
  // occupe le reste (pas de tag staff : aucun tag dedie en base pour
  // l'instant, purement indicatif).
  { x: 370, y: 425, w: 240, h: 250, label: 'Piste de danse' },
  { x: 370, y: 675, w: 240, h: 310, label: 'Stage band & chanteurs' },
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

// Repartition cote Nelly/Gege d'une table, en nombre de personnes prevues.
export interface TableCoteCounts {
  nelly: number;
  gege: number;
}

// Egalite stricte, y compris 0/0, ou absence de donnees : gris neutre.
export function tableCoteClass(counts: TableCoteCounts | undefined): string {
  if (!counts) return 'fill-surface-2 stroke-hairline';
  if (counts.nelly > counts.gege) return 'fill-nelly/25 stroke-nelly';
  if (counts.gege > counts.nelly) return 'fill-gege/25 stroke-gege';
  return 'fill-surface-2 stroke-hairline';
}

interface FloorPlanProps {
  selectedNumber: number | null;
  onSelectNumber: (number: number) => void;
  occupied?: Set<number>;
  // Zone staff selectionnee (identifiee par son staffTag) + callback --
  // optionnels : un appelant qui ne les passe pas garde un plan sans zones
  // cliquables (comportement inchange).
  selectedZoneTag?: string | null;
  onSelectZone?: (room: Room) => void;
  coteByNumber?: Map<number, TableCoteCounts>;
}

export function FloorPlan({
  selectedNumber,
  onSelectNumber,
  occupied,
  selectedZoneTag,
  onSelectZone,
  coteByNumber,
}: FloorPlanProps) {
  return (
    <svg
      viewBox="0 0 1400 1080"
      className="h-auto w-full select-none rounded-xl2 border-2 border-hairline bg-surface"
      role="img"
      aria-label="Plan interactif de la salle : appuyez sur une table pour la sélectionner, ou sur une zone (Bar, Cuisine, DJ et animation, Prestataires) pour voir le personnel associé"
    >
      {ROOMS.map((room, idx) => {
        const clickable = Boolean(room.staffTag && onSelectZone);
        const selected = clickable && selectedZoneTag === room.staffTag;
        return (
          <g
            key={idx}
            className={clsx(clickable && 'cursor-pointer focus:outline-none')}
            onClick={clickable ? () => onSelectZone?.(room) : undefined}
            onKeyDown={
              clickable
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectZone?.(room);
                    }
                  }
                : undefined
            }
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={clickable ? 'Voir le personnel : ' + room.label : undefined}
          >
            <rect
              x={room.x}
              y={room.y}
              width={room.w}
              height={room.h}
              rx={6}
              className={clsx(
                selected
                  ? 'fill-accent-tint stroke-accent'
                  : clickable
                    ? 'fill-surface-2 stroke-accent/50'
                    : 'fill-surface-2 stroke-hairline'
              )}
              strokeWidth={selected ? 3 : 1.5}
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
              className={clsx(
                'text-[13px] font-semibold uppercase tracking-wide',
                selected ? 'fill-accent' : 'fill-text-faint'
              )}
            >
              {room.label}
            </text>
            {room.sub && (
              <text
                x={room.x + room.w / 2}
                y={room.y + room.h / 2 + 14}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-text-faint text-[10px]"
              >
                {room.sub}
              </text>
            )}
          </g>
        );
      })}

      {Object.entries(FLOOR_PLAN_TABLE_POSITIONS).map(([numStr, [x, y]]) => {
        const number = Number(numStr);
        const selected = selectedNumber === number;
        const hasGuests = occupied?.has(number);
        const coteClass = tableCoteClass(coteByNumber?.get(number));
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
                selected ? 'fill-status-complete stroke-status-complete' : coteClass,
                !selected && hasGuests && 'stroke-[3]'
              )}
            />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className={clsx('text-[15px] font-bold', selected ? 'fill-white' : 'fill-text')}
            >
              {number}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
