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

// v1.53.15, retour de Gersom : deux petites fleches d'orientation autour du
// cercle -- "on devrait comprendre où est le nord, est, sud... on va mettre
// une flèche en direction de deux éléments. La piste de danse et les
// mariés. Et la ligne centrale." Angles fournis par
// lib/floorPlanOrientation.ts (calcules depuis la vraie position de la table
// sur components/FloorPlan.tsx), meme convention de rotation que les sieges
// (0° = en haut, sens horaire). Optionnel : absent pour une table sans
// position connue sur le plan.
//
// v1.58.0, retour de Gersom (capture d'ecran table 2) : "mets des signaux
// beaucoup plus clairs... et mets nord, sud, est, ouest" -- les deux fleches
// emoji seules etaient trop discretes pour etre comprises sans explication.
// Fleches agrandies/epaissies + vrai libelle texte (pas seulement l'emoji),
// halo de fond (`paint-order: stroke`) pour rester lisibles par-dessus
// n'importe quel siege/fond. Repere cardinal (N/S/E/O) ajoute en plus : une
// boussole FIXE (toujours "haut = Nord", jamais recalculee par table),
// contrairement aux deux fleches ci-dessus qui pointent chacune vers un
// repere reel et tournent donc differemment par table. Ceci reprend tel
// quel la convention schematique deja utilisee partout ailleurs dans ce
// projet -- jamais une boussole magnetique reelle (le batiment n'a aucune
// orientation GPS connue) : `components/FloorPlan.tsx` place "Couloir Nord"
// en haut (y proche de 0) et "Couloir Est" a droite, et Gersom lui-meme
// decrit depuis le debut les tables 22/23 (premiere colonne du bloc du
// haut) comme etant au "nord-ouest" (v1.48.1) -- donc haut=Nord/droite=Est
// est deja la grille mentale utilisee pour CE plan precis, pas une
// invention de ce lot. Les deux fleches de reperes (danse/allee) supposaient
// deja implicitement cette meme correspondance (leur angle est calcule
// directement depuis les coordonnees du plan, appliquees telles quelles a
// la rotation de la roue) -- la boussole ne fait que la rendre explicite.
export interface TableOrientation {
  danseAngle: number;
  alleeAngle: number;
}

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
  orientation?: TableOrientation | null;
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
// Rayon maximal occupe par une etiquette de siege (SEAT_RADIUS +
// SEAT_HEIGHT/2) : les fleches d'orientation commencent juste au-dela, pour
// ne jamais chevaucher un nom. VIEW_MARGIN elargit le viewBox d'autant
// (sans deplacer aucune coordonnee existante) pour leur faire de la place.
const ARROW_INNER_RADIUS = 146;
const ARROW_OUTER_RADIUS = 172;
const ARROW_LABEL_RADIUS = 188;
// Repere cardinal (N/S/E/O), plus loin encore que les libelles des fleches
// de reperes pour ne jamais s'y superposer.
const COMPASS_RADIUS = 224;
// Marge assez large pour que meme le plus long libelle de fleche ("Allee
// centrale" tronque en "Allee", voir plus bas) ne deborde jamais du viewBox
// quel que soit l'angle (y compris a l'horizontale, le cas le plus large).
const VIEW_MARGIN = 80;

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

// Une fleche : trait + pointe dessines "vers le haut" en coordonnees locales
// (comme un siege a l'angle 0), puis pivotes autour du centre -- meme
// technique que les etiquettes de siege. Le libelle reste volontairement
// hors de ce groupe pivote, place directement par trigonometrie, pour rester
// lisible quel que soit l'angle plutot que de tourner avec la fleche.
//
// v1.58.0 : fleche epaissie/allongee (stroke 2->4, pointe agrandie) et vrai
// libelle texte EN PLUS de l'emoji (pas seulement l'emoji seul, juge trop
// discret) ; `paint-order="stroke"` + un trait de la couleur de fond derriere
// le texte cree un halo qui garde le libelle lisible quel que soit ce qui se
// trouve juste derriere sur le dessin (siege, fond de carte...), sans avoir a
// mesurer/dessiner un rectangle de fond a la largeur du texte.
function OrientationArrow({ angle, emoji, label, title }: { angle: number; emoji: string; label: string; title: string }) {
  const radians = (angle * Math.PI) / 180;
  const labelX = CENTER + Math.sin(radians) * ARROW_LABEL_RADIUS;
  const labelY = CENTER - Math.cos(radians) * ARROW_LABEL_RADIUS;
  return (
    <g>
      <title>{title}</title>
      <g transform={`rotate(${angle} ${CENTER} ${CENTER})`}>
        <line
          x1={CENTER}
          y1={CENTER - ARROW_INNER_RADIUS}
          x2={CENTER}
          y2={CENTER - ARROW_OUTER_RADIUS}
          className="stroke-accent stroke-[4]"
        />
        <polygon
          points={`${CENTER - 8},${CENTER - ARROW_OUTER_RADIUS + 10} ${CENTER + 8},${CENTER - ARROW_OUTER_RADIUS + 10} ${CENTER},${CENTER - ARROW_OUTER_RADIUS - 9}`}
          className="fill-accent"
        />
      </g>
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-text text-[15px] font-bold stroke-bg"
        style={{ paintOrder: 'stroke', strokeWidth: 5, strokeLinejoin: 'round' }}
      >
        {emoji} {label}
      </text>
    </g>
  );
}

// Repere cardinal fixe (toujours haut=Nord, jamais recalcule par table --
// voir le commentaire plus haut sur cette convention schematique). Memes
// halo de lisibilite que OrientationArrow, texte plus discret
// (`text-text-faint`) pour rester secondaire par rapport aux deux fleches de
// reperes, qui restent l'indication principale demandee a l'origine.
function CompassLabel({ angle, label }: { angle: number; label: string }) {
  const radians = (angle * Math.PI) / 180;
  const x = CENTER + Math.sin(radians) * COMPASS_RADIUS;
  const y = CENTER - Math.cos(radians) * COMPASS_RADIUS;
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      className="fill-text-faint text-[14px] font-bold stroke-bg"
      style={{ paintOrder: 'stroke', strokeWidth: 4, strokeLinejoin: 'round' }}
    >
      {label}
    </text>
  );
}

export function TableSeatWheel({ tableNumber, seats, highlightedIndices, onSelectSeat, orientation }: TableSeatWheelProps) {
  const count = seats.length || 10;
  const viewMin = -VIEW_MARGIN;
  const viewSpan = VIEW_SIZE + VIEW_MARGIN * 2;

  return (
    <svg
      viewBox={`${viewMin} ${viewMin} ${viewSpan} ${viewSpan}`}
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

      {orientation && (
        <>
          <OrientationArrow angle={orientation.danseAngle} emoji="💃" label="Piste" title="Direction de la piste de danse et des mariés" />
          <OrientationArrow angle={orientation.alleeAngle} emoji="🚶" label="Allée" title="Direction de l'allée centrale" />
          <CompassLabel angle={0} label="N" />
          <CompassLabel angle={90} label="E" />
          <CompassLabel angle={180} label="S" />
          <CompassLabel angle={270} label="O" />
        </>
      )}
    </svg>
  );
}
