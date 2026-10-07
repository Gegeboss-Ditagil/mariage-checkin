'use client';

import clsx from 'clsx';
import { TABLE_SEAT_NAMES } from '@/lib/floorPlanSeats';

// Plan de la salle. Systeme de coordonnees SVG propre a ce composant, sans
// rapport avec les coordonnees Supabase.
//
// Historique : schema redessine a la main depuis des photos annotees
// (23-24/08/2026), puis reconstruit depuis les exports seatplan.io en
// v1.68.2 (06/10/2026 -- grille de 6 colonnes x 8 rangees separee par
// l'Allee centrale, table 42 = reserve, table 41 = table normale, voir
// migration 0062 ; la table 1 n'apparait nulle part sur le PDF ni dans le
// CSV, signale a Gersom plutot que devine) et retouche en v1.69.1
// (07/10/2026, zones peripheriques seulement, grille inchangee).
//
// v1.70.0 (07/10/2026) : retour de Gersom, avec le PDF seatplan.io du jour
// -- « assure-toi que la map est pareille dans l'app, il manque des détails
// surtout dans les à-côtés, on dirait une mauvaise reproduction... fais-le
// en détail, mets les sorties et autres comme dans ce plan. » Le plan n'est
// plus un schema redessine a la main : chaque zone, porte, sortie et table
// est reprise de la GEOMETRIE VECTORIELLE du PDF (position et taille de
// chaque image de zone mesurees par pdf.js, puis ajustees aux pixels
// colores reels ; position du texte des portes/sorties), convertie par une
// seule transformation uniforme (pdfToPlan : origine (146, 70) en points
// PDF, echelle x2.2 sur les DEUX axes -- proportions du PDF conservees,
// l'ancien plan etait etire d'environ 9 % en largeur). Couleurs = palette
// seatplan.io relevee sur le PDF. Ajouts : sorties d'urgence (x3), porte
// d'acces chapiteau, acces toilettes, acces vers la S..., couloir Est
// delimite par cable rouge, long rideau blanc, barre « garder acces libre »,
// separations temporaires, extension de piste pour le show, espace
// orchestre, sections A/B/C, Sangria, RP, PO, SO, CO, « Les mariées »,
// mini-tables des maries / du DJ / du staff, et les chaises autour de
// chaque table (vides en pointilles, comme les chaises vides du PDF). Les
// zones « Cuisine » et « Zone enfants », absentes du PDF, disparaissent ;
// les zones cliquables de personnel sont conservees sur leur equivalent du
// PDF (Bar, DJ et animation, Buffets A/B pour le traiteur, Table staff pour
// le photographe et les autres prestataires).
const PLAN_ORIGIN_X = 146;
const PLAN_ORIGIN_Y = 70;
const PLAN_SCALE = 2.2;

// Points PDF (repere de l'export seatplan.io, A4 paysage 842 x 595) ->
// unites du plan. Seule source de conversion -- les tables ci-dessous sont
// deja converties (litteraux entiers, relus par tests/floor-plan.test.ts).
function pdfToPlan(x: number, y: number, w = 0, h = 0): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.round((x - PLAN_ORIGIN_X) * PLAN_SCALE),
    y: Math.round((y - PLAN_ORIGIN_Y) * PLAN_SCALE),
    w: Math.round(w * PLAN_SCALE),
    h: Math.round(h * PLAN_SCALE),
  };
}

// Centres des tables = centre du cercle de chaque table dans le PDF du
// 07/10/2026, passes par pdfToPlan. Meme grille et meme contenu que
// v1.68.2/v1.69.1 -- seule la precision change.
export const FLOOR_PLAN_TABLE_POSITIONS: Record<number, [number, number]> = {
  // Rangees au-dessus de l'Allee centrale.
  25: [282, 95], 24: [378, 91], 39: [475, 91], 14: [572, 91], 19: [673, 91], 17: [772, 86],
  11: [280, 197], 3: [379, 191], 10: [477, 189], 18: [573, 191], 34: [673, 190], 37: [772, 182],
  4: [379, 287], 12: [476, 287], 16: [572, 288], 22: [672, 287], 23: [771, 282],
  5: [379, 386], 9: [475, 385], 21: [572, 388], 20: [672, 386], 35: [773, 386],
  // Rangees au-dessous de l'Allee centrale.
  2: [379, 547], 6: [474, 546], 13: [573, 548], 29: [673, 548], 40: [779, 549],
  33: [378, 649], 32: [476, 647], 8: [574, 647], 28: [674, 651], 38: [777, 649],
  30: [381, 752], 36: [477, 750], 7: [574, 750], 15: [674, 749], 42: [775, 748],
  31: [381, 857], 41: [478, 857], 26: [574, 858], 27: [674, 861],
  // Table 1 : absente du PDF et du CSV depuis v1.68.2 -- gardee HORS PLAN,
  // sous le cadre de la salle, plutot que posee sur une zone qui n'existe
  // pas (dessinee en pointilles, libellee « hors plan »).
  1: [60, 962],
};
export const OFF_PLAN_TABLES = new Set([1]);

// En-tetes de zone purement decoratifs (pas de tag staff, pas de clic).
// v1.70.0 : le PDF n'a plus d'en-tete Nord/Sud dessine -- la « zone Nord »
// n'y apparait que dans le libelle des buffets, repris tel quel.
export interface ZoneLabel {
  x: number;
  y: number;
  label: string;
}

export const FLOOR_PLAN_ZONE_LABELS: ZoneLabel[] = [];

// Palette seatplan.io relevee sur le PDF (pixels de chaque zone).
export type PlanColor = 'cyan' | 'amber' | 'pink' | 'purple' | 'orange' | 'indigo' | 'lime' | 'emerald' | 'red';
export const PLAN_COLORS: Record<PlanColor, { fill: string; text: string }> = {
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
  // (couloirs, separations) ont un libelle plus petit pour tenir dedans.
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
// hauteur] en points PDF, mesure sur l'export du 07/10/2026.
const ROOMS: Room[] = [
  // -- Cote ouest (gauche) ---------------------------------------------
  room([161, 84, 51.5, 56], 'WC handicapés', 'cyan', { labelSize: 14 }),
  // « WH » sur le PDF, entre le WC handicapes et le WC femmes.
  room([162, 142.5, 57, 32], 'WC hommes', 'cyan', { sub: 'WH' }),
  room([160, 176, 60, 36], 'WC femmes', 'cyan', { sub: 'Fermé durant les discours', labelSize: 15 }),
  room([186, 212.5, 34, 22.5], 'Bar', 'amber', { sub: 'Repas & soirée', staffTag: 'Bar', labelSize: 15 }),
  room([155, 269, 41, 101], 'Les mariés', 'pink', { vertical: true, labelDy: 46, labelSize: 16 }),
  room([155.5, 373, 40.3, 109.3], 'DJ et animation', 'purple', { vertical: true, staffTag: 'DJ_Animation', labelDy: 38, labelSize: 14 }),
  room([200, 268.5, 94, 184.5], 'Extension piste', 'orange', { sub: 'Pour le show' }),
  room([221.5, 197.5, 76, 70], 'Piste de danse', 'orange'),
  room([199.8, 455.5, 74.3, 25.5], 'Espace orchestre', 'indigo', { sub: 'Chanteurs · band & instruments', labelSize: 14 }),
  // -- Circulations ----------------------------------------------------
  room([197, 76, 340, 6.8], 'Couloir Nord', 'lime', { labelSize: 11 }),
  room([296.8, 269.3, 224.5, 24.5], 'Allée centrale', 'lime'),
  room([521.8, 88.8, 7.5, 344.3], 'Long rideau blanc', 'red', { vertical: true, labelSize: 11 }),
  room([530.3, 76, 8.8, 240.5], 'Couloir Est', 'lime', { vertical: true, labelSize: 11, sub: 'câble rouge · accès WC', labelDy: 96 }),
  room([473, 440, 56.5, 43.3], 'CO', 'lime'),
  // -- Cote est (droite) -----------------------------------------------
  room([550.8, 78.5, 112.3, 7.3], 'Buffet B · tables zone Nord', 'orange', { labelSize: 11, staffTag: 'Traiteur' }),
  room([550.3, 88.8, 113.8, 7.8], 'Buffet A · tables zone Nord', 'orange', { labelSize: 11, staffTag: 'Traiteur' }),
  room([595.5, 100, 20, 19], 'PO', 'indigo'),
  room([592.3, 138, 24, 6.3], 'Les mariées', 'amber', { labelSize: 8 }),
  room([644.8, 123.5, 17, 12], 'SO', 'cyan'),
  room([525, 168.5, 143.5, 13.8], 'Garder accès libre · sortie d’urgence', 'red', { labelSize: 12 }),
  room([547.5, 184.3, 42, 129], 'Section A', 'emerald', { sub: 'Invités · discours', labelSize: 15 }),
  room([611.3, 186.5, 60.3, 71.5], 'Section B', 'emerald', { sub: 'Invités · discours' }),
  room([609.5, 289.3, 62.5, 24.8], 'Section C', 'emerald', { sub: 'Si l’espace le permet', labelSize: 14 }),
  room([530.5, 335, 148.3, 148], "Vin d'honneur", 'amber', { sub: 'Zone de service' }),
  room([574.5, 353.3, 76.5, 6.8], 'Séparation temporaire', 'red', { labelSize: 10 }),
  room([657.8, 361.8, 7.3, 97.3], 'Séparation temporaire', 'red', { vertical: true, labelSize: 10 }),
  room([548.8, 468.8, 104.8, 6.5], 'Séparation temporaire', 'red', { labelSize: 10 }),
  room([651.3, 338.5, 20.5, 20.5], 'Sangria', 'purple', { round: true, labelSize: 12 }),
  room([656.8, 461.3, 20.5, 20.3], 'RP', 'purple', { round: true }),
];

// Mini-tables hors grille dessinees sur le PDF (table des maries dans la
// zone rose, table du DJ dans la zone violette, table du staff sous le
// bar) -- [x, y, largeur, hauteur] en points PDF, nombre de chaises du PDF.
interface MiniTable {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  seats: number;
  // La table staff porte la zone cliquable du photographe et des autres
  // prestataires (« No Table Staff » du PDF : assistants photo, Carla...).
  staffTag?: string;
}
function miniTable(pdf: [number, number, number, number], label: string, seats: number, staffTag?: string): MiniTable {
  const { x, y, w, h } = pdfToPlan(...pdf);
  return { x, y, w, h, label, seats, staffTag };
}
const MINI_TABLES: MiniTable[] = [
  miniTable([180.6, 243.3, 44.2, 17.1], 'Table staff', 8, 'Photographe'),
  miniTable([170, 285, 12, 27.3], 'Mariés', 2),
  miniTable([167.5, 382.6, 12, 27.2], 'DJ', 2),
];

// Room equivalente a la table staff, transmise a l'appelant quand on la
// touche (app/plan-table/page.tsx affiche label/sub de la zone choisie).
const STAFF_TABLE_ROOM: Room = {
  x: MINI_TABLES[0].x,
  y: MINI_TABLES[0].y,
  w: MINI_TABLES[0].w,
  h: MINI_TABLES[0].h,
  label: 'Prestataires & staff',
  sub: 'Photographe et autres',
  color: 'amber',
  staffTag: 'Photographe',
};

// Portes, sorties et acces ecrits sur le PDF (texte seul sur le plan
// seatplan.io, sans zone dessinee) -- position du texte en points PDF.
export interface PlanMarker {
  x: number;
  y: number;
  icon: string;
  label: string;
  kind: 'exit' | 'door';
  rotate?: number;
}
function marker(pdfX: number, pdfY: number, icon: string, label: string, kind: PlanMarker['kind'], rotate?: number): PlanMarker {
  const { x, y } = pdfToPlan(pdfX, pdfY);
  return { x, y, icon, label, kind, rotate };
}
export const PLAN_MARKERS: PlanMarker[] = [
  marker(236, 88, '🚪', 'Accès toilettes', 'door'),
  marker(292, 488, '🚨', 'Sortie d’urgence', 'exit'),
  marker(500, 490, '🚪', 'Porte accès chapiteau', 'door'),
  marker(662, 160, '🚨', 'Sortie d’urgence', 'exit'),
  marker(668, 276, '➜', 'Accès vers la S…', 'door'),
  marker(690, 420, '🚨', 'Sortie d’urgence', 'exit', 90),
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
}: FloorPlanProps) {
  return (
    <svg
      viewBox="0 0 1220 1005"
      className="h-auto w-full select-none rounded-xl2 border-2 border-hairline bg-surface"
      role="img"
      aria-label="Plan interactif de la salle : appuyez sur une table pour la sélectionner, ou sur une zone (Bar, Buffets, DJ et animation, Table staff) pour voir le personnel associé"
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
          textAnchor="middle"
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
        const offPlan = OFF_PLAN_TABLES.has(number);
        const seats = offPlan ? [] : TABLE_SEAT_NAMES[number] ?? [];
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
            aria-label={'Table ' + number + (offPlan ? ' (hors plan)' : '')}
          >
            {/* Zone de contact plus large que le cercle visible, pour rester
                facile a toucher sur mobile (cible tactile ~44px minimum). */}
            <circle cx={x} cy={y} r={34} fill="transparent" />
            {seats.map((name, idx) => (
              <rect
                key={idx}
                x={x - SEAT_W / 2}
                y={y - SEAT_RING_RADIUS - SEAT_H / 2}
                width={SEAT_W}
                height={SEAT_H}
                rx={3}
                transform={'rotate(' + (360 / seats.length) * idx + ' ' + x + ' ' + y + ')'}
                className={name ? 'fill-text-faint stroke-none' : 'fill-none stroke-text-faint'}
                fillOpacity={name ? 0.55 : undefined}
                strokeWidth={name ? 0 : 1.2}
                strokeDasharray={name ? undefined : '3 2'}
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
              strokeDasharray={offPlan && !selected ? '5 4' : undefined}
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
            {offPlan && (
              <text x={x + 40} y={y} dominantBaseline="middle" className="fill-text-faint text-[13px] font-semibold">
                Table {number} · hors plan (absente du PDF)
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
