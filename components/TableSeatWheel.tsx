'use client';

import clsx from 'clsx';

// Dessin circulaire d'une table (v1.48.2, retour de Gersom : "je veux voir un
// dessin plutot de chaque table avec les places... juste une image de la
// table avec leurs differents noms et leurs sieges, et voir aussi les sieges
// vides" -- remplace l'ancienne grille de boutons par un rendu fidele aux
// photos seatplan.io transmises : dix etiquettes rayonnant autour d'un
// cercle central, dans le sens horaire depuis le haut, chacune tournee a son
// propre angle.
//
// v1.53.10 : retour de Gersom (photo seatplan.io en reference) -- "ce n'est
// pas facile [a lire], ce n'est pas evident... et en plus tu fais des
// erreurs" (lecture des noms trop souvent ambigue une fois inclinee dans le
// sens du cercle) : "s'ils sont plutot affiches en perpendiculaire et que
// c'est justement juste le cote court du rectangle qui touche la tangente du
// cercle, ca serait plus efficace". Jusqu'ici (v1.48.0-v1.53.3), l'etiquette
// etait une pastille LARGE (cote long tangent au cercle, comme un maillon de
// chaine suivant la courbe) -- desormais une pastille ETROITE et LONGUE
// (cote court tangent, cote long radial, comme un rayon de roue) : seul
// SEAT_WIDTH/SEAT_HEIGHT sont inverses par rapport a l'ancienne version, la
// rotation du groupe entier reste la meme rotation en sens horaire depuis le
// haut -- inverser les dimensions locales suffit a faire pivoter le rendu de
// 90 degres a chaque position. "La logique de comment il raccourcit les
// noms" : seatplan.io tronque le prenom (avec "...") sur la premiere ligne
// et garde le reste du nom sur la seconde -- voir splitSeatLabel ci-dessous,
// jamais une source de verite (le nom complet reste utilise tel quel par
// namesMatch/findSeatIndexByName, purement un habillage d'affichage).
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
const SEAT_RADIUS = 110;
// Cote court (tangent au cercle) et cote long (radial, vers l'exterieur) --
// inverses par rapport a l'ancienne pastille "large" (v1.48.2-v1.53.3).
const SEAT_WIDTH = 46;
const SEAT_HEIGHT = 64;
// Ecart vertical de chaque ligne de texte par rapport au centre de
// l'etiquette, dans le repere local (avant rotation du groupe).
const LINE_OFFSET = 11;
const MAX_LINE_CHARS = 8;

function truncateLine(s: string): string {
  return s.length > MAX_LINE_CHARS ? s.slice(0, MAX_LINE_CHARS) + '…' : s;
}

// Scinde un nom en (jusqu'a) deux lignes courtes empilees radialement,
// inspire du rendu seatplan.io observe sur les photos transmises par Gersom
// (prenom tronque avec "..." s'il ne tient pas dans l'etiquette desormais
// etroite, nom de famille sur la ligne du dessous). Un nom a un seul mot
// (rare mais possible) reste sur une seule ligne centree.
function splitSeatLabel(name: string): [string, string | null] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [truncateLine(words[0] || name), null];
  return [truncateLine(words[0]), truncateLine(words.slice(1).join(' '))];
}

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
        const [line1, line2] = name ? splitSeatLabel(name) : [null, null];
        const textClassName = clsx(
          'text-[9px] font-semibold leading-none',
          !name ? 'fill-text-faint' : highlighted ? 'fill-on-accent' : 'fill-text'
        );
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
              rx={10}
              className={clsx(
                'stroke-2 transition-colors',
                !name ? 'fill-surface-2 stroke-hairline' : highlighted ? 'fill-accent stroke-accent' : 'fill-surface-2 stroke-hairline'
              )}
              strokeDasharray={name ? undefined : '5 4'}
            />
            {name ? (
              <>
                <text x={CENTER} y={seatCenterY - (line2 ? LINE_OFFSET : 0)} textAnchor="middle" dominantBaseline="middle" className={textClassName}>
                  {line1}
                </text>
                {line2 && (
                  <text x={CENTER} y={seatCenterY + LINE_OFFSET} textAnchor="middle" dominantBaseline="middle" className={textClassName}>
                    {line2}
                  </text>
                )}
              </>
            ) : (
              <text x={CENTER} y={seatCenterY} textAnchor="middle" dominantBaseline="middle" className={textClassName}>
                Vide
              </text>
            )}
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
