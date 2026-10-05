'use client';

import clsx from 'clsx';

// Coordonnees du plan de la salle, redessinees a la main a partir des photos
// annotees fournies par Gersom (23/08/2026, puis mise a jour du 23/08/2026
// avec numerotation ajustee + nouvelles zones ; puis correctif du 24/08/2026
// sur l'emplacement des tables 34/35/36/37, confirme par Gersom apres
// relecture du rendu) -- schema simplifie, pas une trace pixel par pixel de
// la photo, que l'app ne peut pas embarquer.
// Systeme de coordonnees SVG propre a ce composant, en unites arbitraires
// (viewBox 0 0 1750 1080, elargi de 1400 en v1.68.0 pour les 2 blocs de
// tables cote a cote), sans rapport avec les coordonnees Supabase.
//
// v1.68.0 (05/10/2026) : disposition entierement reconstruite pour le plan
// de table FINAL seatplan.io transmis par Gersom (4 photos de zones +
// seating-chart PDF revision 3 + guest-list_57.csv), remplacant la
// disposition v1.48.0 a 42 tables (nord/sud). Nouvelle structure : 41
// tables, en 4 zones cardinales nommees explicitement par Gersom -- "photo
// 2 zone nord ouest juste a cote a gauche [de la zone nord-est] ... de
// l'autre cote de l'allee centrale, au-dessous, nous avons zone sud-est ...
// et pour finir zone sud-ouest". Disposition macro retenue : Nord-Ouest et
// Nord-Est cote a cote en haut (NO a gauche), Sud-Ouest et Sud-Est cote a
// cote en bas (SO sous NO, SE sous NE), separees par l'Allee centrale deja
// dessinee ci-dessous -- exactement la disposition decrite par Gersom.
// Chaque zone reprend l'ORDRE de lecture des tables tel que transcrit depuis
// sa photo (schema simplifie en grille, jamais une trace pixel par pixel ni
// une reproduction de la disposition circulaire des photos, que l'app ne
// peut pas embarquer) :
//   Nord-Ouest (9 tables)  : 30, 35, 39 / 32, 36, 2 / 6, 1, 13
//   Nord-Est   (12 tables) : 26, 27, 38, 7 / 31, 15, 8, 29 / 41, 33, 28, 40
//   Sud-Ouest  (8 tables)  : 5, 21, 4, 23 / 3, 10, 12, 9
//   Sud-Est    (12 tables) : 20, 11, 25, 22 / 34, 24, 18, 16 / 37, 14, 19, 17
// Table 41 (reserve "excedentaire" depuis ce lot, ex-"Houston") : positionnee
// dans sa case naturelle de la zone Nord-Est, comme sur la photo -- jamais
// isolee. Table 42 ("Johannesburg") n'existe plus dans ce plan (decommissionnee,
// voir migration 0061) et n'a donc plus de position ici.
export const FLOOR_PLAN_TABLE_POSITIONS: Record<number, [number, number]> = {
  // Zone Nord-Ouest (3 colonnes x 3 rangees, bloc gauche du haut, colonnes
  // 644-804, espacement 80 -- memes colonnes que la zone Sud-Ouest, meme
  // borne gauche que l'ex zone nord v1.48.0 pour degager la salle "Piste de
  // danse" a gauche (x<=610)).
  30: [644, 118], 35: [724, 118], 39: [804, 118],
  32: [644, 218], 36: [724, 218], 2: [804, 218],
  6: [644, 318], 1: [724, 318], 13: [804, 318],
  // Zone Nord-Est (4 colonnes x 3 rangees, bloc droit du haut, colonnes
  // 1050-1290, espacement 80 -- separees du bloc Nord-Ouest par au moins
  // 100 unites (>> rayon de cible tactile x2 = 68) pour qu'aucune paire de
  // tables ne se chevauche. Memes rangees Y que Nord-Ouest.
  26: [1050, 118], 27: [1130, 118], 38: [1210, 118], 7: [1290, 118],
  31: [1050, 218], 15: [1130, 218], 8: [1210, 218], 29: [1290, 218],
  41: [1050, 318], 33: [1130, 318], 28: [1210, 318], 40: [1290, 318],
  // Zone Sud-Ouest (4 colonnes x 2 rangees, bloc gauche du bas -- memes
  // colonnes X que Nord-Ouest, sous l'Allee centrale).
  5: [644, 580], 21: [724, 580], 4: [804, 580], 23: [884, 580],
  3: [644, 680], 10: [724, 680], 12: [804, 680], 9: [884, 680],
  // Zone Sud-Est (4 colonnes x 3 rangees, bloc droit du bas -- memes
  // colonnes X que Nord-Est).
  20: [1050, 580], 11: [1130, 580], 25: [1210, 580], 22: [1290, 580],
  34: [1050, 680], 24: [1130, 680], 18: [1210, 680], 16: [1290, 680],
  37: [1050, 780], 14: [1130, 780], 19: [1210, 780], 17: [1290, 780],
};

// En-tetes de zone purement decoratifs (pas de tag staff, pas de clic) --
// distincts de ROOMS pour ne jamais etre confondus avec une zone
// selectionnable de personnel.
export interface ZoneLabel {
  x: number;
  y: number;
  label: string;
}

export const FLOOR_PLAN_ZONE_LABELS: ZoneLabel[] = [
  // v1.68.0 : 4 labels (un par zone cardinale), places dans l'espace libre a
  // gauche du bloc nord/sud (x:420-630, meme gap que l'ex "Zone nord"/"Zone
  // sud" v1.48.0) plutot qu'au-dessus de chaque bloc -- aucune marge
  // verticale suffisante entre le Couloir Nord (finit y=80) et la premiere
  // rangee de tables (cible tactile des le y=84).
  { x: 520, y: 170, label: 'Nord-Ouest' },
  { x: 520, y: 300, label: 'Nord-Est' },
  { x: 520, y: 600, label: 'Sud-Ouest' },
  { x: 520, y: 740, label: 'Sud-Est' },
];

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
  // v1.68.0 : "Allée centrale"/"Couloir Nord"/"Couloir Sud" elargis pour
  // couvrir toute la largeur des 2 blocs de tables cote a cote (NO+NE en
  // haut, SO+SE en bas, voir FLOOR_PLAN_TABLE_POSITIONS) -- la zone de
  // tables s'etend desormais jusqu'a x=1324 au lieu de x=1030.
  { x: 610, y: 425, w: 730, h: 90, label: 'Allée centrale' },
  { x: 630, y: 20, w: 710, h: 60, label: 'Couloir Nord' },
  { x: 440, y: 950, w: 900, h: 55, label: 'Couloir Sud' },
  // Colonne/salles decoratives de droite, decalees de +320 (v1.68.0) pour
  // degager la place necessaire aux 2 blocs de tables Nord-Est/Sud-Est.
  { x: 1350, y: 20, w: 45, h: 940, label: 'Couloir Est', vertical: true },
  { x: 1405, y: 20, w: 300, h: 60, label: 'Buffet A' },
  { x: 1405, y: 90, w: 300, h: 60, label: 'Buffet B' },
  { x: 1375, y: 160, w: 335, h: 130, label: 'Espace discours', sub: 'Orateur · Les mariés' },
  { x: 1375, y: 300, w: 130, h: 280, label: 'Invités' },
  { x: 1580, y: 300, w: 130, h: 280, label: 'Invités' },
  { x: 1375, y: 600, w: 335, h: 340, label: "Vin d'honneur" },
];

function centerOf(room: Room): [number, number] {
  return [room.x + room.w / 2, room.y + room.h / 2];
}

// v1.53.15, retour de Gersom (repère d'orientation sur le dessin "vu sur le
// plan photographié") : "on va tout simplement mettre une flèche en
// direction de deux éléments. La piste de danse et les mariés. Et la ligne
// centrale." -- reperes exportes pour lib/floorPlanOrientation.ts, calcules
// depuis les memes salles que celles dessinees ici (jamais une seconde
// source de coordonnees qui pourrait diverger si le plan est retouche).
// "Piste de danse" et "Les mariés" sont traitees comme UN seul repere
// combine (moyenne des deux centres, les deux salles etant adjacentes) --
// Gersom ne demande qu'une seule fleche pour les deux ensemble.
const pisteDeDanseRoom = ROOMS.find((r) => r.label === 'Piste de danse')!;
const lesMariesRoom = ROOMS.find((r) => r.label === 'Les mariés')!;
const alleeCentraleRoom = ROOMS.find((r) => r.label === 'Allée centrale')!;
const [pisteX, pisteY] = centerOf(pisteDeDanseRoom);
const [mariesX, mariesY] = centerOf(lesMariesRoom);
export const DANCE_FLOOR_LANDMARK: [number, number] = [(pisteX + mariesX) / 2, (pisteY + mariesY) / 2];
export const CENTRAL_AISLE_LANDMARK: [number, number] = centerOf(alleeCentraleRoom);

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
      viewBox="0 0 1750 1080"
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

      {FLOOR_PLAN_ZONE_LABELS.map((zone, idx) => (
        <text
          key={idx}
          x={zone.x}
          y={zone.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-text-faint text-[13px] font-semibold uppercase tracking-wide"
        >
          {zone.label}
        </text>
      ))}

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
