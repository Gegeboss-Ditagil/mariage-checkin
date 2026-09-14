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
// v1.48.0 (14/09/2026) : disposition entierement reconstruite a partir des
// deux photos zoomees ("zone nord"/"zone sud") transmises par Gersom apres
// la reorganisation familiale ("les tables sont un peu melangees comparees
// a avant"). Extraction par OCR (crops zoomes de chaque table, lus un par
// un), CROISEE avec deux sources independantes pour eviter toute erreur de
// lecture silencieuse (regle docs/DATA_CHANGE_INSTRUCTIONS.md section 6) :
// (1) les tags de table T0xx/F0xx du CSV With Joy le plus recent
// (guest-list_48.csv) matchent exactement les memes numeros aux memes noms
// pour plusieurs tables (ex: table 8 = "Luzolo P. Menga"/"Tia Nzuzi
// Culumbu", tag F008 en CSV) ; (2) l'arithmetique ferme (les deux photos
// couvrent ensemble exactement les 42 tables sans doublon ni trou, chaque
// zone formant une grille complete) confirme qu'aucun numero n'est manquant
// ou en double. Reste approximatif au pixel pres (redessine a la main,
// jamais une trace exacte), mais l'ORDRE et le VOISINAGE de chaque table
// avec ses voisines reproduit fidelement la grille de chaque photo. La
// numerotation elle-meme n'a pas de sens geographique cardinal fixe (malgre
// les etiquettes "nord"/"sud" de Gersom, les tables 22/23 apparaissent
// physiquement dans le meme bloc que 41/42) -- seul l'agencement relatif
// vu sur les photos est repris ici, pas une interpretation de boussole.
//
// Correctif du 14/09/2026 (retour de Gersom sur capture d'ecran de l'app) :
// les deux zones etaient inversees -- la zone a 22 tables (avec la paire
// 22/23) doit etre au NORD (en haut), pas au sud, et la grille 5x4 "propre"
// doit etre au SUD (en bas). Corrige en permutant uniquement la bande de
// rangees Y de chaque bloc (memes colonnes X qu'avant, donc meme alignement
// et memes tables cote a cote) : aucune position n'est "devinee", seul le
// bloc entier change de bande verticale.
//
// Zone nord (haut, 6 colonnes x 4 rangees ; les 2 cases vides en bas a
// gauche correspondent a la zone "Piste et File Attente" visible sur la
// photo, deja representee par la salle "Piste de danse" existante -- aucune
// table n'y est dessinee) :
//   Rangee 1 : 22, 18, 24, 31, 41, 42
//   Rangee 2 : 23, 30, 29, 7, 36, 40
//   Rangee 3 : (vide), 8, 28, 26, 37, 39
//   Rangee 4 : (vide), 33, 38, 21, 34, 35
// La paire 22/23 (premiere colonne, rangees 1-2) se retrouve ainsi bien au
// nord-ouest, comme demande. Tables 41 ("Houston", reguliere depuis v1.47.0)
// et 42 ("Johannesburg", reserve) : positionnees exactement comme sur la
// photo, en bout de la premiere rangee, jamais isolees ni devinees.
// Zone sud (bas, 5 colonnes x 4 rangees) :
//   Rangee 1 : 4, 5, 13, 12, 20
//   Rangee 2 : 2, 3, 6, 14, 19
//   Rangee 3 : 11, 25, 32, 15, 27
//   Rangee 4 : 1, 10, 16, 17, 9
export const FLOOR_PLAN_TABLE_POSITIONS: Record<number, [number, number]> = {
  // Zone nord (6 colonnes ; colonne x=644 vide sur les rangees 3-4 -- la
  // cible tactile de chaque table, rayon 34, doit degager la salle "Piste de
  // danse"/"Stage band" a gauche (x<=610) et le "Couloir Est" a droite
  // (x>=1030) : colonnes bornees a 644-996 pour degager les deux.
  22: [644, 118], 18: [714, 118], 24: [785, 118], 31: [855, 118], 41: [926, 118], 42: [996, 118],
  23: [644, 210], 30: [714, 210], 29: [785, 210], 7: [855, 210], 36: [926, 210], 40: [996, 210],
  8: [714, 302], 28: [785, 302], 26: [855, 302], 37: [926, 302], 39: [996, 302],
  33: [714, 394], 38: [785, 394], 21: [855, 394], 34: [926, 394], 35: [996, 394],
  // Zone sud (colonnes alignees sur celles de la zone nord pour une grille
  // visuellement cohesive : 644-996, memes bornes que la zone nord ci-dessus).
  4: [644, 610], 5: [732, 610], 13: [820, 610], 12: [908, 610], 20: [996, 610],
  2: [644, 690], 3: [732, 690], 6: [820, 690], 14: [908, 690], 19: [996, 690],
  11: [644, 770], 25: [732, 770], 32: [820, 770], 15: [908, 770], 27: [996, 770],
  1: [644, 850], 9: [732, 850], 10: [820, 850], 16: [908, 850], 17: [996, 850],
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
  // A gauche du bloc nord (espace libre entre les salles WC/Bar et les
  // tables, x:420-630/y:80-425) -- au-dessus des tables elles-memes, il n'y
  // a que 4px entre le bas du Couloir Nord et le haut des cibles tactiles.
  { x: 520, y: 256, label: 'Zone nord' },
  // Entre l'allee centrale (finit y=515) et la premiere rangee sud (cible
  // tactile a partir de y=576).
  { x: 815, y: 548, label: 'Zone sud' },
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
