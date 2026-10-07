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
// v1.68.2 (06/10/2026) : disposition entierement reconstruite depuis le
// nouvel export seatplan.io (seating-chart-...-2026-10-06_1.pdf, vectoriel)
// + guest-list_58.csv, remplacant la disposition en 4 zones cardinales de
// v1.68.0 -- retour de Gersom : "disposition of table have changed, most of
// the table that where in the south zone are now in the north zone and
// vice-versa". Le nouveau PDF dessine une seule grille de 6 colonnes x 8
// rangees (pas 2 blocs cote a cote), separee en deux moities par l'Allee
// centrale deja dessinee ci-dessous -- schema simplifie reprenant l'ORDRE de
// lecture exact des coordonnees du PDF (texte vectoriel, pas une photo),
// jamais une trace pixel par pixel :
//   Au-dessus de l'allee (rangees 1-4) : 25,24,39,14,19,17 / 11,3,10,18,34,37
//                                        / 4,12,16,22,23 / 5,9,21,20,35
//   Au-dessous de l'allee (rangees 5-8) : 2,6,13,29,40 / 33,32,8,28,38
//                                        / 30,36,7,15,42 / 31,41,26,27
// Confirme avec Gersom avant d'ecrire quoi que ce soit : la table 42 reprend
// le role de reserve "excedentaire" (vide sur ce PDF), la table 41 devient
// une table normale desormais occupee -- voir migration 0062, qui inverse
// 0061. La table 1 n'apparait nulle part sur ce nouveau PDF ni dans le CSV
// (tags F/T de 002 a 041 seulement) -- signale a Gersom plutot que devine
// (voir CHANGELOG v1.68.2) ; elle garde ici la seule case encore libre de la
// grille plutot que de perdre toute position.
export const FLOOR_PLAN_TABLE_POSITIONS: Record<number, [number, number]> = {
  // Rangees au-dessus de l'Allee centrale (6 colonnes, x:630-1130, espacement
  // 100 ; rangees y:120-405, espacement 95).
  25: [630, 120], 24: [730, 120], 39: [830, 120], 14: [930, 120], 19: [1030, 120], 17: [1130, 120],
  11: [630, 215], 3: [730, 215], 10: [830, 215], 18: [930, 215], 34: [1030, 215], 37: [1130, 215],
  // Table 1 : absente du PDF/CSV (voir en-tete) -- placee dans l'unique
  // emplacement encore libre de la grille (colonne la plus a gauche, rangee
  // 3), jamais isolee hors grille.
  1: [630, 310], 4: [730, 310], 12: [830, 310], 16: [930, 310], 22: [1030, 310], 23: [1130, 310],
  5: [730, 405], 9: [830, 405], 21: [930, 405], 20: [1030, 405], 35: [1130, 405],
  // Rangees au-dessous de l'Allee centrale (y:540-825, espacement 95).
  2: [730, 540], 6: [830, 540], 13: [930, 540], 29: [1030, 540], 40: [1130, 540],
  33: [730, 635], 32: [830, 635], 8: [930, 635], 28: [1030, 635], 38: [1130, 635],
  30: [730, 730], 36: [830, 730], 7: [930, 730], 15: [1030, 730], 42: [1130, 730],
  31: [730, 825], 41: [830, 825], 26: [930, 825], 27: [1030, 825],
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
  // v1.68.2 : une seule grille de tables desormais (plus 2 blocs cote a
  // cote), donc 2 labels (Nord/Sud) au lieu des 4 zones cardinales de
  // v1.68.0 -- places dans l'espace libre a gauche de la grille (x:420-630,
  // meme gap que v1.68.0/v1.48.0), centres verticalement sur leur moitie de
  // grille respective.
  { x: 520, y: 260, label: 'Nord' },
  { x: 520, y: 680, label: 'Sud' },
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
