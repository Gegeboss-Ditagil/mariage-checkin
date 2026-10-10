'use client';

import clsx from 'clsx';
import { TABLE_SEAT_NAMES } from '@/lib/floorPlanSeats';
import { floorPlanChairs } from '@/lib/liveSeats';
import { isReserveTableNumber } from '@/lib/withjoyImport';

// Plan de la salle. Systeme de coordonnees SVG propre a ce composant, sans
// rapport avec les coordonnees Supabase.
//
// Historique : schema redessine a la main depuis des photos annotees
// (23-24/08/2026), reconstruit depuis les exports seatplan.io en v1.68.2
// (grille de 6 colonnes x 8 rangees separee par l'Allee centrale), puis
// reproduction fidele de la geometrie vectorielle du PDF en v1.70.0.
//
// v1.71.0 (07/10/2026) : nouvel export seatplan.io (« seating-chart ... (7).pdf »,
// format Tabloid 1224 x 792 pts, plus A4) -- retour de Gersom : « corrige
// bien les éléments comme la map donnée et aligne les tables et autres comme
// dans l'image, change les noms des objets de la salle (tables vin
// d'honneur, sections invités...) comme la table staff, aligne bien pour
// que ce soit propre ». Toute la geometrie est remesuree sur ce PDF (pdf.js :
// position de chaque image de zone, puis etendue reelle des pixels colores),
// les libelles reprennent les noms du PDF (Zone concert et show, Bar soirée,
// Couloir Sud – Chapiteau, Vin d'honneur & buffet, Tables vin d'honneur
// C/D/E, Cloisons temporaires A/B/média-buffet, Section D, table Staff), et
// les centres de tables sont ALIGNES : chaque table prend la moyenne de sa
// colonne et de sa rangee dans le PDF (ecarts de 1 a 4 pts gommes), pour une
// grille parfaitement droite.
//
// Reserves (migration 0066, v1.72.0) : la table 1 « Maquela do Zombo » et la
// table 42 sont les deux tables excedentaires, l'une sous l'autre dans la
// colonne de droite du bloc Sud (PDF seatplan.io (8), qui ne change que cela
// et la largeur du Couloir Sud par rapport au PDF (7)).
const PLAN_ORIGIN_X = 200;
const PLAN_ORIGIN_Y = 70;
const PLAN_SCALE = 1.5;

// Points PDF (repere de l'export seatplan.io du 07/10/2026) -> unites du
// plan. Seule source de conversion -- les tables ci-dessous sont deja
// converties (litteraux entiers, relus par tests/floor-plan.test.ts).
function pdfToPlan(x: number, y: number, w = 0, h = 0): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.round((x - PLAN_ORIGIN_X) * PLAN_SCALE),
    y: Math.round((y - PLAN_ORIGIN_Y) * PLAN_SCALE),
    w: Math.round(w * PLAN_SCALE),
    h: Math.round(h * PLAN_SCALE),
  };
}

// Grille alignee : 6 colonnes (x = 284, 385, 485, 585, 688, 792) et 8
// rangees (y = 91, 193, 293, 396 au nord de l'Allee ; 562, 666, 770, 882 au
// sud) -- moyenne de chaque colonne/rangee du PDF passee par pdfToPlan.
export const FLOOR_PLAN_TABLE_POSITIONS: Record<number, [number, number]> = {
  // Rangees au-dessus de l'Allee centrale.
  25: [284, 91], 24: [385, 91], 39: [485, 91], 14: [585, 91], 19: [688, 91], 17: [792, 91],
  11: [284, 193], 3: [385, 193], 10: [485, 193], 18: [585, 193], 34: [688, 193], 37: [792, 193],
  4: [385, 293], 12: [485, 293], 16: [585, 293], 22: [688, 293], 23: [792, 293],
  5: [385, 396], 9: [485, 396], 21: [585, 396], 20: [688, 396], 35: [792, 396],
  // Rangees au-dessous de l'Allee centrale.
  2: [385, 562], 6: [485, 562], 13: [585, 562], 29: [688, 562], 40: [792, 562],
  33: [385, 666], 32: [485, 666], 8: [585, 666], 28: [688, 666], 38: [792, 666],
  // Table 1 « Maquela do Zombo » : reserve excedentaire (v1.71.0), vide.
  30: [385, 770], 36: [485, 770], 7: [585, 770], 15: [688, 770], 1: [792, 770],
  31: [385, 882], 41: [485, 882], 26: [585, 882], 27: [688, 882],
  // Table 42 : seconde reserve excedentaire (v1.72.0, PDF seatplan.io (8)),
  // dessinee dans la colonne de droite entre la table 1 et le Couloir Sud
  // (position du PDF projetee sur ce repere, colonne alignee).
  42: [792, 853],
};

// Palette seatplan.io relevee sur le PDF (pixels de chaque zone).
export type PlanColor = 'cyan' | 'amber' | 'pink' | 'purple' | 'orange' | 'indigo' | 'lime' | 'emerald' | 'red';
const PLAN_COLORS: Record<PlanColor, { fill: string; text: string }> = {
  cyan: { fill: '#06b6d4', text: '#083344' },
  amber: { fill: '#f59e0b', text: '#451a03' },
  pink: { fill: '#ec4899', text: '#ffffff' },
  purple: { fill: '#a855f7', text: '#ffffff' },
  orange: { fill: '#f97316', text: '#431407' },
  indigo: { fill: '#6366f1', text: '#ffffff' },
  lime: { fill: '#84cc16', text: '#1a2e05' },
  emerald: { fill: '#10b981', text: '#022c22' },
  red: { fill: '#ef4444', text: '#ffffff' },
};

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  color: PlanColor;
  // Cercle (Sangria, RP) au lieu d'un rectangle -- comme sur le PDF.
  round?: boolean;
  // Libelle pivote a 90 deg pour les bandes verticales etroites.
  vertical?: boolean;
  // Taille du libelle principal (unites du plan) -- les bandes fines
  // (couloirs, cloisons) ont un libelle plus petit pour tenir dedans.
  labelSize?: number;
  // Decalage vertical du libelle (unites du plan) quand le centre de la
  // zone est occupe -- mini-table des maries/DJ, barre de sortie d'urgence
  // qui traverse le couloir Est (meme position que le texte du PDF).
  labelDy?: number;
  // Tag staff (deja present sur les invitations en base, voir lib/tags) --
  // present uniquement sur les zones cliquables. Cliquer la zone affiche le
  // personnel portant ce tag, sous le plan (voir app/plan-table/page.tsx).
  staffTag?: string;
}

function room(
  pdf: [number, number, number, number],
  label: string,
  color: PlanColor,
  extra: Partial<Omit<Room, 'x' | 'y' | 'w' | 'h' | 'label' | 'color'>> = {}
): Room {
  const { x, y, w, h } = pdfToPlan(...pdf);
  return { x, y, w, h, label, color, ...extra };
}

// Zones dans l'ordre de dessin du PDF. Chaque quadruplet = [x, y, largeur,
// hauteur] en points PDF, mesure sur l'export du 07/10/2026. Libelles = noms
// du PDF (v1.71.0).
const ROOMS: Room[] = [
  // -- Cote ouest (gauche) ---------------------------------------------
  room([218.5, 89.5, 86.5, 85], 'WC handicapés', 'cyan', { labelSize: 14 }),
  // « WH » sur le PDF, entre le WC handicapes et le WC femmes.
  room([220, 177, 86, 49.5], 'WC hommes', 'cyan', { sub: 'WH', labelSize: 15 }),
  room([216.5, 228.5, 91.5, 54], 'WC femmes', 'cyan', { sub: 'Fermé durant les discours', labelSize: 15 }),
  room([259, 285.5, 48.5, 34], 'Bar soirée', 'amber', { staffTag: 'Bar', labelSize: 11 }),
  room([210.5, 369.5, 60.5, 153], 'Les mariés', 'pink', { vertical: true, labelDy: 46, labelSize: 16 }),
  room([210.5, 526.5, 60.5, 165.5], 'DJ et animation', 'purple', { vertical: true, staffTag: 'DJ_Animation', labelDy: 41, labelSize: 14 }),
  room([277.5, 368.5, 142.5, 279.5], 'Zone concert et show', 'orange', { labelSize: 16 }),
  room([309.5, 261, 109, 104.5], 'Piste de danse', 'orange'),
  room([277, 651.5, 113, 38.5], 'Espace orchestre', 'indigo', { sub: 'Chanteurs · band & instruments', labelSize: 14 }),
  // -- Circulations ----------------------------------------------------
  room([272.5, 78, 522.5, 9.5], 'Couloir Nord', 'lime', { labelSize: 11 }),
  room([424, 376.5, 336, 21.5], 'Allée centrale', 'lime'),
  room([765.5, 91, 15.5, 526.5], 'Long rideau blanc', 'red', { vertical: true, labelSize: 12 }),
  room([783, 77.5, 15, 367.5], 'Couloir Est', 'lime', { vertical: true, labelSize: 11, sub: 'câble rouge · accès WC', labelDy: 124 }),
  // v1.72.0 : réduit en bande sur le PDF (8) pour laisser la place à la table 42.
  room([699, 672, 87, 15], 'Couloir Sud · Chapiteau', 'lime', { labelSize: 8.5 }),
  // -- Cote est (droite) -----------------------------------------------
  room([808.5, 81.5, 169, 11], 'Buffet B · tables zone Nord', 'orange', { labelSize: 11, staffTag: 'Traiteur' }),
  room([807.5, 97, 172, 11.5], 'Buffet A · tables zone Nord', 'orange', { labelSize: 11, staffTag: 'Traiteur' }),
  room([876, 113.5, 30, 29.5], 'PO', 'indigo'),
  room([870.5, 171, 37.5, 10], 'Les mariées', 'amber', { labelSize: 9 }),
  room([950.5, 149, 26, 19], 'SO', 'cyan'),
  room([804, 183, 185, 9.5], 'Cloison temporaire · séparation zone média-buffet', 'cyan', { labelSize: 9 }),
  room([773.5, 222.5, 217.5, 20.5], 'Garder accès libre · sortie d’urgence', 'red', { labelSize: 13 }),
  room([803.5, 246, 62, 103.5], 'Section A', 'emerald', { sub: 'Invités · discours', labelSize: 15 }),
  room([900, 244.5, 90.5, 108], 'Section B', 'emerald', { sub: 'Invités · discours' }),
  room([806, 355, 185, 10], 'Cloison temporaire B · chantier zone média', 'cyan', { labelSize: 9 }),
  room([805.5, 369, 59, 79], 'Section D', 'emerald', { sub: 'Invités · discours', labelSize: 15 }),
  room([897, 400, 95, 37.5], 'Section C', 'emerald', { sub: 'Si l’espace le permet', labelSize: 14 }),
  room([787, 454.5, 213.5, 10], 'Cloison temporaire A', 'cyan', { labelSize: 9 }),
  room([787.5, 469.5, 214, 223.5], "Vin d'honneur & buffet", 'amber', { sub: 'Zone de service', labelSize: 14 }),
  room([844, 496.5, 115.5, 10.5], 'Table vin d’honneur C', 'red', { labelSize: 10 }),
  room([970.5, 509.5, 10, 147.5], 'Table vin d’honneur D', 'red', { vertical: true, labelSize: 10 }),
  room([805.5, 671, 158, 10.5], 'Table vin d’honneur E', 'red', { labelSize: 10 }),
  room([962.5, 476.5, 27, 27], 'Sangria', 'purple', { round: true, labelSize: 12 }),
  room([970.5, 662, 27, 27], 'RP', 'purple', { round: true }),
];

// Mini-tables hors grille dessinees sur le PDF (table Staff sous le bar,
// table des maries dans la zone rose, table du DJ dans la zone violette) --
// [x, y, largeur, hauteur] en points PDF, nombre de chaises du PDF.
interface MiniTable {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  seats: number;
  // La table Staff porte la zone cliquable du photographe et des autres
  // prestataires (assistants photo, Carla...).
  staffTag?: string;
}
function miniTable(pdf: [number, number, number, number], label: string, seats: number, staffTag?: string): MiniTable {
  const { x, y, w, h } = pdfToPlan(...pdf);
  return { x, y, w, h, label, seats, staffTag };
}
const MINI_TABLES: MiniTable[] = [
  miniTable([229, 313.5, 20, 52], 'Staff', 8, 'Photographe'),
  miniTable([230.5, 396.5, 19.5, 34.5], 'Mariés', 2),
  miniTable([226.5, 544.5, 19.5, 34.5], 'DJ', 2),
];

// Room equivalente a la table Staff, transmise a l'appelant quand on la
// touche (app/plan-table/page.tsx affiche label/sub de la zone choisie).
const STAFF_TABLE_ROOM: Room = {
  x: MINI_TABLES[0].x,
  y: MINI_TABLES[0].y,
  w: MINI_TABLES[0].w,
  h: MINI_TABLES[0].h,
  label: 'Table Staff',
  sub: 'Photographe et prestataires',
  color: 'amber',
  staffTag: 'Photographe',
};

// Portes, sorties et acces ecrits sur le PDF (texte seul sur le plan
// seatplan.io, sans zone dessinee) -- centre du texte en points PDF.
interface PlanMarker {
  x: number;
  y: number;
  icon: string;
  label: string;
  kind: 'exit' | 'door';
  rotate?: number;
  // Ancrage du texte : 'end' pour les reperes du bord droit, qui sinon
  // deborderaient du cadre (le PDF ecrit ce texte hors de la salle).
  anchor?: 'middle' | 'end';
}
function marker(pdfX: number, pdfY: number, icon: string, label: string, kind: PlanMarker['kind'], rotate?: number, anchor?: 'middle' | 'end'): PlanMarker {
  const { x, y } = pdfToPlan(pdfX, pdfY);
  return { x, y, icon, label, kind, rotate, anchor };
}
const PLAN_MARKERS: PlanMarker[] = [
  marker(330, 100, '🚪', 'Accès toilettes', 'door'),
  marker(430, 684, '🚨', 'Sortie d’urgence', 'exit'),
  marker(740, 700, '🚪', 'Porte accès chapiteau', 'door'),
  marker(1010, 207, '🚨', 'Sortie d’urgence', 'exit', undefined, 'end'),
  marker(1010, 386, '➜', 'Accès vers la S…', 'door', undefined, 'end'),
  marker(1007, 600, '🚨', 'Sortie d’urgence', 'exit', 90),
];

function centerOf(r: Room): [number, number] {
  return [r.x + r.w / 2, r.y + r.h / 2];
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

// Chaises autour de chaque table, comme sur le PDF : occupees (pleines) ou
// vides (pointilles). Source = TABLE_SEAT_NAMES (meme export PDF, purement
// informatif, voir lib/floorPlanSeats.ts). Anneau limite a ~46 unites du
// centre pour ne jamais toucher les chaises de la table voisine (~96-100).
const TABLE_RADIUS = 27;
const SEAT_RING_RADIUS = 39;
const SEAT_W = 10;
const SEAT_H = 14;

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
  // v1.74.0 : personnes réellement placées par table (lib/capacity.ts,
  // excédents en réserve compris). Absent = chaises du PDF telles quelles.
  occupiedSeatsByNumber?: Map<number, number>;
}

function zoneHandlers(clickable: boolean, select: () => void) {
  if (!clickable) return {};
  return {
    onClick: select,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    },
    role: 'button' as const,
    tabIndex: 0,
  };
}

export function FloorPlan({
  selectedNumber,
  onSelectNumber,
  occupied,
  selectedZoneTag,
  onSelectZone,
  coteByNumber,
  occupiedSeatsByNumber,
}: FloorPlanProps) {
  return (
    <svg
      viewBox="0 0 1220 950"
      className="h-auto w-full select-none rounded-xl2 border-2 border-hairline bg-surface"
      role="img"
      aria-label="Plan interactif de la salle : appuyez sur une table pour la sélectionner, ou sur une zone (Bar soirée, Buffets, DJ et animation, table Staff) pour voir le personnel associé"
    >
      {ROOMS.map((r, idx) => {
        const clickable = Boolean(r.staffTag && onSelectZone);
        const selected = clickable && selectedZoneTag === r.staffTag;
        const palette = PLAN_COLORS[r.color];
        const [cx, cy0] = centerOf(r);
        const cy = cy0 + (r.labelDy ?? 0);
        const size = r.labelSize ?? 17;
        return (
          <g
            key={idx}
            className={clsx(clickable && 'cursor-pointer focus:outline-none')}
            {...zoneHandlers(clickable, () => onSelectZone?.(r))}
            aria-label={clickable ? 'Voir le personnel : ' + r.label : undefined}
          >
            {r.round ? (
              <circle cx={cx} cy={cy0} r={r.w / 2} fill={palette.fill} />
            ) : (
              <rect
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                rx={Math.min(8, r.w / 3, r.h / 3)}
                fill={palette.fill}
                className={clsx(selected ? 'stroke-accent' : clickable ? 'stroke-white/80' : 'stroke-none')}
                strokeWidth={selected ? 5 : clickable ? 2.5 : 0}
                strokeDasharray={clickable && !selected ? '8 5' : undefined}
              />
            )}
            <text
              x={cx}
              y={cy - (r.sub && !r.vertical ? size * 0.55 : 0)}
              textAnchor="middle"
              dominantBaseline="middle"
              transform={r.vertical ? 'rotate(-90 ' + cx + ' ' + cy + ')' : undefined}
              fill={palette.text}
              style={{ fontSize: size }}
              className="font-bold uppercase tracking-wide"
            >
              {r.label}
              {r.vertical && r.sub ? ' · ' + r.sub : ''}
            </text>
            {r.sub && !r.vertical && (
              <text
                x={cx}
                y={cy + size * 0.75}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={palette.text}
                style={{ fontSize: Math.max(10, size * 0.72) }}
                className="font-medium"
              >
                {r.sub}
              </text>
            )}
          </g>
        );
      })}

      {MINI_TABLES.map((t, idx) => {
        const clickable = Boolean(t.staffTag && onSelectZone);
        const selected = clickable && selectedZoneTag === t.staffTag;
        const horizontal = t.w >= t.h;
        const seatsPerSide = Math.ceil(t.seats / 2);
        return (
          <g
            key={'mini-' + idx}
            className={clsx(clickable && 'cursor-pointer focus:outline-none')}
            {...zoneHandlers(clickable, () => onSelectZone?.(STAFF_TABLE_ROOM))}
            aria-label={clickable ? 'Voir le personnel : ' + STAFF_TABLE_ROOM.label : undefined}
          >
            {Array.from({ length: t.seats }, (_, i) => {
              const before = i < seatsPerSide;
              const k = i % seatsPerSide;
              const along = (horizontal ? t.w : t.h) * ((k + 0.5) / seatsPerSide);
              const sx = horizontal ? t.x + along - 6 : before ? t.x - 15 : t.x + t.w + 3;
              const sy = horizontal ? (before ? t.y - 15 : t.y + t.h + 3) : t.y + along - 6;
              return <rect key={i} x={sx} y={sy} width={12} height={12} rx={3} className="fill-surface-2 stroke-text-faint" strokeWidth={1.5} />;
            })}
            <rect
              x={t.x}
              y={t.y}
              width={t.w}
              height={t.h}
              rx={5}
              fill="#d6b98c"
              stroke={selected ? undefined : '#a3845a'}
              className={clsx(selected && 'stroke-accent')}
              strokeWidth={selected ? 4 : 1.5}
            />
            <text
              x={t.x + t.w / 2}
              y={t.y + t.h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              transform={horizontal ? undefined : 'rotate(-90 ' + (t.x + t.w / 2) + ' ' + (t.y + t.h / 2) + ')'}
              fill="#3b2a12"
              style={{ fontSize: 11 }}
              className="font-bold"
            >
              {t.label}
            </text>
          </g>
        );
      })}

      {PLAN_MARKERS.map((m, idx) => (
        <text
          key={'marker-' + idx}
          x={m.x}
          y={m.y}
          textAnchor={m.anchor ?? 'middle'}
          dominantBaseline="middle"
          transform={m.rotate ? 'rotate(' + m.rotate + ' ' + m.x + ' ' + m.y + ')' : undefined}
          className={clsx('font-bold uppercase stroke-bg', m.kind === 'exit' ? 'fill-status-over' : 'fill-text')}
          style={{ fontSize: 13, paintOrder: 'stroke', strokeWidth: 4, strokeLinejoin: 'round' }}
        >
          {m.icon} {m.label}
        </text>
      ))}

      {Object.entries(FLOOR_PLAN_TABLE_POSITIONS).map(([numStr, [x, y]]) => {
        const number = Number(numStr);
        const selected = selectedNumber === number;
        const hasGuests = occupied?.has(number);
        const coteClass = tableCoteClass(coteByNumber?.get(number));
        const seats = floorPlanChairs(TABLE_SEAT_NAMES[number] ?? [], occupiedSeatsByNumber?.get(number));
        // v1.71.0 / v1.72.0 : les tables de reserve (1 et 42, excedentaires)
        // sont signalees par un contour en pointilles et la mention « réserve ».
        const isReserve = isReserveTableNumber(number);
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
            aria-label={'Table ' + number + (isReserve ? ' (réserve excédentaire)' : '')}
          >
            {/* Zone de contact plus large que le cercle visible, pour rester
                facile a toucher sur mobile (cible tactile ~44px minimum). */}
            <circle cx={x} cy={y} r={34} fill="transparent" />
            {seats.map((filled, idx) => (
              <rect
                key={idx}
                x={x - SEAT_W / 2}
                y={y - SEAT_RING_RADIUS - SEAT_H / 2}
                width={SEAT_W}
                height={SEAT_H}
                rx={3}
                transform={'rotate(' + (360 / seats.length) * idx + ' ' + x + ' ' + y + ')'}
                className={filled ? 'fill-text-faint stroke-none' : 'fill-none stroke-text-faint'}
                fillOpacity={filled ? 0.55 : undefined}
                strokeWidth={filled ? 0 : 1.2}
                strokeDasharray={filled ? undefined : '3 2'}
              />
            ))}
            {selected && (
              <circle cx={x} cy={y} r={TABLE_RADIUS + 5} className="fill-status-complete/20 stroke-status-complete" strokeWidth={4} />
            )}
            <circle
              cx={x}
              cy={y}
              r={TABLE_RADIUS}
              className={clsx(
                'stroke-2',
                selected ? 'fill-status-complete stroke-status-complete' : coteClass,
                !selected && hasGuests && 'stroke-[3]'
              )}
              strokeDasharray={isReserve && !selected ? '6 4' : undefined}
            />
            <text
              x={x}
              y={isReserve ? y - 5 : y}
              textAnchor="middle"
              dominantBaseline="middle"
              className={clsx('text-[15px] font-bold', selected ? 'fill-white' : 'fill-text')}
            >
              {number}
            </text>
            {isReserve && (
              <text
                x={x}
                y={y + 11}
                textAnchor="middle"
                dominantBaseline="middle"
                className={clsx('text-[8px] font-semibold uppercase', selected ? 'fill-white' : 'fill-text-muted')}
              >
                réserve
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
