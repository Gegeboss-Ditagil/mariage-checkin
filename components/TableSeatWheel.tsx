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
//
// v1.66.0, retour de Gersom (dessin a main levee sur une capture d'ecran de
// /plan-table) : les deux reperes danse/allee restent compris mais trop
// discrets -- "il serait interessant qu'en allant sur les tables, on voit
// vraiment mieux un espece de carre ou rectangle qui signifie la piste...
// l'emoji de la personne qui danse devrait etre beaucoup plus grand...
// l'allee, ca devrait etre un espece de petit rectangle... un emoji d'une
// personne qui marche beaucoup plus grande." Le simple libelle texte
// (emoji+mot sur une ligne, 15px) devient une vraie pastille rectangulaire
// (voir LandmarkTile) : fond colore + bordure, emoji isole et agrandi au-
// dessus d'une legende. Piste = pastille carree (forme compacte, comme la
// piste de danse reelle) ; Allee = pastille plus large qu'haute (forme
// allongee, comme une allee) -- les deux formes different volontairement.
// "Pour mieux resize l'element, baisse la table... un peu plus d'espace
// dans ce carre-la pour les emojis" : HUB_RADIUS (le cercle central avec le
// numero de table) reduit de 56 a 44 pour degager de la place visuelle.
// Toujours PUREMENT INFORMATIF, jamais une donnee ecrite en base.
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
// v1.66.0, retour de Gersom : "baisse la table... tu as un peu plus
// d'espace dans ce carré-là pour justement les emojis" -- reduit de 56 a 44
// pour degager de la place visuelle au profit des reperes (voir plus bas),
// sans toucher au rayon des sieges.
const HUB_RADIUS = 44;
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
// v1.69.3, retour de Gersom (capture d'ecran table 39) : "il ne faut pas
// que la fleche superpose l'espece de rectangle. Il faut que ca indique
// vers le rectangle, mais il ne faut pas que ca soit par-dessus." La pointe
// de la fleche s'arrete a ARROW_TIP_RADIUS ; la pastille (voir
// LandmarkTile) est ensuite placee pour que son bord le plus proche
// commence TILE_GAP plus loin, en tenant compte de sa vraie forme dans la
// direction de la fleche (voir tileCenterDistance). L'ancien rayon fixe
// (TILE_RADIUS = 190, v1.66.0) faisait chevaucher la pointe et le
// rectangle a presque tous les angles.
const ARROW_TIP_RADIUS = 170;
const TILE_GAP = 6;
// v1.66.0 : vraie pastille rectangulaire (emoji isole + legende). Piste =
// carre (forme compacte, comme la piste de danse reelle) ; Allee =
// rectangle plus large qu'haut (forme allongee, comme une allee).
// v1.69.3, "agrandie... les images de piste et de l'allee... pour que ca
// soit beaucoup plus clair" : pastilles et emoji nettement agrandis
// (54x54 / 78x44 / 26px auparavant) -- sans elargir le
// viewBox au-dela de l'ancien carre dans le pire cas (pastilles a gauche et
// a droite), sinon les sieges retreciraient sur ces tables-la.
const PISTE_TILE_WIDTH = 72;
const PISTE_TILE_HEIGHT = 72;
const ALLEE_TILE_WIDTH = 98;
const ALLEE_TILE_HEIGHT = 68;
const EMOJI_FONT_SIZE = 36;
// Repere cardinal (N/S/E/O) : v1.69.3, deplace dans l'anneau libre entre le
// cercle central (HUB_RADIUS = 44) et le bord interieur des sieges
// (SEAT_RADIUS - SEAT_HEIGHT/2 = 78) -- les pastilles agrandies occupent
// desormais tout l'anneau exterieur, ou la boussole les aurait chevauchees
// a certains angles.
const COMPASS_RADIUS = 61;
// Marge assez large pour contenir la pastille la plus eloignee quel que
// soit l'angle (pire cas ~274 du centre, verifie par
// tests/table-orientation-arrows.test.ts).
const VIEW_MARGIN = 116;

// Distance du centre de la table au centre d'une pastille w x h placee dans
// la direction `angle` (0 deg = haut, sens horaire), de sorte que son bord
// le plus proche soit exactement a ARROW_TIP_RADIUS + TILE_GAP. Pour un
// rectangle centre, la distance centre->bord le long d'un vecteur unitaire
// (sx, cy) vaut min((w/2)/|sx|, (h/2)/|cy|).
export function tileCenterDistance(angle: number, w: number, h: number): number {
  const radians = (angle * Math.PI) / 180;
  const sx = Math.abs(Math.sin(radians));
  const cy = Math.abs(Math.cos(radians));
  const halfExtent = Math.min(sx > 1e-9 ? w / 2 / sx : Infinity, cy > 1e-9 ? h / 2 / cy : Infinity);
  return ARROW_TIP_RADIUS + TILE_GAP + halfExtent;
}

// Rayon englobant les etiquettes de siege, coins compris
// (sqrt((SEAT_RADIUS + SEAT_HEIGHT/2)^2 + (SEAT_WIDTH/2)^2) ~ 143.8), arrondi.
const SEAT_EXTENT = 146;
const VIEW_PADDING = 4;

// v1.69.3, "agrandie" : le viewBox epouse le contenu reel (cercle des
// sieges + les DEUX pastilles a leurs vrais angles) au lieu d'un carre fixe
// prevu pour le pire cas a tous les angles a la fois -- l'espace vide
// autour disparait, le dessin occupe donc plus de place a l'ecran sans
// changer aucune coordonnee interne. VIEW_MARGIN reste la borne maximale
// (jamais depassee, verifie par les tests).
export function computeWheelViewBox(orientation?: TableOrientation | null): { x: number; y: number; width: number; height: number } {
  let minX = CENTER - SEAT_EXTENT;
  let maxX = CENTER + SEAT_EXTENT;
  let minY = CENTER - SEAT_EXTENT;
  let maxY = CENTER + SEAT_EXTENT;
  if (orientation) {
    const tiles: [number, number, number][] = [
      [orientation.danseAngle, PISTE_TILE_WIDTH, PISTE_TILE_HEIGHT],
      [orientation.alleeAngle, ALLEE_TILE_WIDTH, ALLEE_TILE_HEIGHT],
    ];
    for (const [angle, w, h] of tiles) {
      const radians = (angle * Math.PI) / 180;
      const r = tileCenterDistance(angle, w, h);
      const cx = CENTER + Math.sin(radians) * r;
      const cy = CENTER - Math.cos(radians) * r;
      minX = Math.min(minX, cx - w / 2);
      maxX = Math.max(maxX, cx + w / 2);
      minY = Math.min(minY, cy - h / 2);
      maxY = Math.max(maxY, cy + h / 2);
    }
  }
  minX = Math.max(minX - VIEW_PADDING, -VIEW_MARGIN);
  minY = Math.max(minY - VIEW_PADDING, -VIEW_MARGIN);
  maxX = Math.min(maxX + VIEW_PADDING, VIEW_SIZE + VIEW_MARGIN);
  maxY = Math.min(maxY + VIEW_PADDING, VIEW_SIZE + VIEW_MARGIN);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export const LANDMARK_GEOMETRY = {
  ARROW_TIP_RADIUS,
  TILE_GAP,
  PISTE_TILE_WIDTH,
  PISTE_TILE_HEIGHT,
  ALLEE_TILE_WIDTH,
  ALLEE_TILE_HEIGHT,
  VIEW_SIZE,
  VIEW_MARGIN,
};

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

// Une fleche (trait + pointe, meme technique de rotation que les etiquettes
// de siege) pointant vers une pastille rectangulaire -- jamais tournee avec
// la fleche, placee directement par trigonometrie pour rester lisible quel
// que soit l'angle. v1.58.0 : fleche epaissie/allongee. v1.66.0, retour de
// Gersom (dessin a main levee) : le simple libelle texte (emoji+mot en
// 15px) devient une vraie pastille -- rectangle de fond (couleur accent,
// comme une mini-etiquette de lieu) avec l'emoji isole et agrandi au-dessus
// d'une legende texte, au lieu d'une seule ligne emoji+mot. `tileWidth`/
// `tileHeight` different entre Piste (carre) et Allee (rectangle plus
// large), chacun refletant la forme reelle du lieu qu'il designe.
function LandmarkTile({
  angle,
  emoji,
  label,
  title,
  tileWidth,
  tileHeight,
}: {
  angle: number;
  emoji: string;
  label: string;
  title: string;
  tileWidth: number;
  tileHeight: number;
}) {
  const radians = (angle * Math.PI) / 180;
  // v1.69.3 : rayon calcule selon la forme et l'angle, pour que la pastille
  // commence toujours juste APRES la pointe de la fleche (jamais dessous).
  const tileRadius = tileCenterDistance(angle, tileWidth, tileHeight);
  const tileX = CENTER + Math.sin(radians) * tileRadius;
  const tileY = CENTER - Math.cos(radians) * tileRadius;
  // L'emoji occupe la bande superieure de la pastille, la legende la bande
  // inferieure -- jamais tournes avec la fleche (voir plus haut).
  const emojiY = tileY - tileHeight * 0.12;
  const labelY = tileY + tileHeight * 0.32;
  return (
    <g>
      <title>{title}</title>
      <g transform={`rotate(${angle} ${CENTER} ${CENTER})`}>
        <line
          x1={CENTER}
          y1={CENTER - ARROW_INNER_RADIUS}
          x2={CENTER}
          y2={CENTER - ARROW_TIP_RADIUS + 12}
          className="stroke-accent stroke-[4]"
          strokeLinecap="round"
        />
        <polygon
          points={`${CENTER - 8},${CENTER - ARROW_TIP_RADIUS + 14} ${CENTER + 8},${CENTER - ARROW_TIP_RADIUS + 14} ${CENTER},${CENTER - ARROW_TIP_RADIUS}`}
          className="fill-accent"
          strokeLinejoin="round"
        />
      </g>
      <rect
        x={tileX - tileWidth / 2}
        y={tileY - tileHeight / 2}
        width={tileWidth}
        height={tileHeight}
        rx={18}
        className="fill-accent-tint stroke-accent stroke-2"
      />
      <text x={tileX} y={emojiY} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: EMOJI_FONT_SIZE }}>
        {emoji}
      </text>
      <text x={tileX} y={labelY} textAnchor="middle" dominantBaseline="middle" className="fill-text text-[14px] font-bold">
        {label}
      </text>
    </g>
  );
}

// Repere cardinal fixe (toujours haut=Nord, jamais recalcule par table --
// voir le commentaire plus haut sur cette convention schematique). Meme
// halo de lisibilite (paint-order: stroke) que le libelle des pastilles de
// LandmarkTile, texte plus discret (`text-text-faint`) pour rester
// secondaire par rapport a Piste/Allee, qui restent l'indication principale
// demandee a l'origine.
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
      className="fill-text-faint text-[11px] font-bold stroke-bg"
      style={{ paintOrder: 'stroke', strokeWidth: 3, strokeLinejoin: 'round' }}
    >
      {label}
    </text>
  );
}

export function TableSeatWheel({ tableNumber, seats, highlightedIndices, onSelectSeat, orientation }: TableSeatWheelProps) {
  const count = seats.length || 10;
  const { x: viewX, y: viewY, width: viewW, height: viewH } = computeWheelViewBox(orientation);

  return (
    <svg
      viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
      className="mx-auto h-auto w-full max-w-[560px] select-none"
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
          <LandmarkTile
            angle={orientation.danseAngle}
            emoji="💃"
            label="Piste"
            title="Direction de la piste de danse et des mariés"
            tileWidth={PISTE_TILE_WIDTH}
            tileHeight={PISTE_TILE_HEIGHT}
          />
          <LandmarkTile
            angle={orientation.alleeAngle}
            emoji="🚶"
            label="Allée"
            title="Direction de l'allée centrale"
            tileWidth={ALLEE_TILE_WIDTH}
            tileHeight={ALLEE_TILE_HEIGHT}
          />
          <CompassLabel angle={0} label="N" />
          <CompassLabel angle={90} label="E" />
          <CompassLabel angle={180} label="S" />
          <CompassLabel angle={270} label="O" />
        </>
      )}
    </svg>
  );
}
