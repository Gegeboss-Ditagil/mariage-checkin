'use client';

import clsx from 'clsx';

// Dessin circulaire d'une table (v1.48.2, retour de Gersom : "je veux voir un
// dessin plutot de chaque table avec les places... juste une image de la
// table avec leurs differents noms et leurs sieges, et voir aussi les sieges
// vides" -- remplace l'ancienne grille de boutons par un rendu fidele aux
// photos seatplan.io transmises : dix etiquettes rayonnant autour d'un
// cercle central, dans le sens horaire depuis le haut, chacune tournee a son
// propre angle -- exactement comme sur les photos, ou les etiquettes du bas
// se retrouvent donc la tete en bas (aucune correction de lisibilite : c'est
// le rendu que Gersom a lui-meme montre en exemple).
//
// PUREMENT INFORMATIF (voir lib/floorPlanSeats.ts) : aucune interaction ici
// n'ecrit en base -- `onSelectSeat` ne fait que faire remonter un index a
// surligner localement, comme sur l'exemple de carte nominative montre par
// Gersom (on touche un nom, son siege se met en evidence sur le dessin).
// v1.48.5 : `highlightedIndices` accepte plusieurs sieges a la fois (ex.
// tous les membres d'une meme invitation surlignes ensemble depuis
// /plan-table, ou l'unique siege d'une personne depuis
// /checkin/[invitationId]) -- ce composant reste un simple afficheur, la
// semantique (bascule ou remplacement) vit chez l'appelant.

interface TableSeatWheelProps {
  tableNumber: number;
  seats: (string | null)[];
  // v1.48.5 : plusieurs sieges a la fois (ex. tous les membres d'une meme
  // invitation tapee sur /plan-table) -- un tableau vide = aucun surligne.
  // L'appelant decide de la semantique (bascule un seul siege sur un tap
  // dans la roue elle-meme, remplace tout le tableau sur un tap venant
  // d'une autre liste) ; ce composant se contente d'afficher l'ensemble.
  highlightedIndices: number[];
  onSelectSeat: (index: number) => void;
}

const VIEW_SIZE = 320;
const CENTER = VIEW_SIZE / 2;
const HUB_RADIUS = 56;
// Distance du CENTRE de chaque etiquette de siege au centre de la table.
const SEAT_RADIUS = 118;
const SEAT_WIDTH = 82;
const SEAT_HEIGHT = 36;

export function TableSeatWheel({ tableNumber, seats, highlightedIndices, onSelectSeat }: TableSeatWheelProps) {
  const count = seats.length || 10;

  return (
    <svg
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      className="mx-auto h-auto w-full max-w-[360px] select-none"
      role="img"
      aria-label={`Places de la table ${tableNumber} vues sur le plan photographié`}
    >
      {seats.map((name, idx) => {
        const angle = (360 / count) * idx; // sens horaire depuis le haut, comme sur les photos.
        const highlighted = highlightedIndices.includes(idx);
        // Coordonnees locales (avant rotation) : l'etiquette est placee
        // directement au-dessus du centre, comme le siege "0" a midi -- la
        // rotation du groupe entier l'amene ensuite a sa vraie position.
        const seatCenterY = CENTER - SEAT_RADIUS;
        return (
          <g
            key={idx}
            transform={`rotate(${angle} ${CENTER} ${CENTER})`}
            className={clsx(name && 'cursor-pointer focus:outline-none')}
            onClick={name ? () => onSelectSeat(idx) : undefined}
            onKeyDown={
              name
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectSeat(idx);
                    }
                  }
                : undefined
            }
            role={name ? 'button' : undefined}
            tabIndex={name ? 0 : undefined}
            aria-label={name ? `Siège ${idx + 1} : ${name}` : `Siège ${idx + 1}, vide`}
          >
            <rect
              x={CENTER - SEAT_WIDTH / 2}
              y={seatCenterY - SEAT_HEIGHT / 2}
              width={SEAT_WIDTH}
              height={SEAT_HEIGHT}
              rx={9}
              className={clsx(
                'stroke-2 transition-colors',
                !name ? 'fill-surface-2 stroke-hairline' : highlighted ? 'fill-accent stroke-accent' : 'fill-surface-2 stroke-hairline'
              )}
              strokeDasharray={name ? undefined : '5 4'}
            />
            <text
              x={CENTER}
              y={seatCenterY}
              textAnchor="middle"
              dominantBaseline="middle"
              className={clsx(
                'text-[9px] font-semibold leading-none',
                !name ? 'fill-text-faint' : highlighted ? 'fill-on-accent' : 'fill-text'
              )}
            >
              {name || 'Vide'}
            </text>
          </g>
        );
      })}

      <circle cx={CENTER} cy={CENTER} r={HUB_RADIUS} className="fill-accent-tint stroke-accent" strokeWidth={2} />
      <text x={CENTER} y={CENTER} textAnchor="middle" dominantBaseline="middle" className="fill-accent text-2xl font-bold">
        {tableNumber}
      </text>
    </svg>
  );
}
