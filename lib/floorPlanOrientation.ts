import { FLOOR_PLAN_TABLE_POSITIONS, DANCE_FLOOR_LANDMARK, CENTRAL_AISLE_LANDMARK } from '@/components/FloorPlan';

// v1.53.15, retour de Gersom (capture d'écran de /plan-table) : "quand on
// voit la table, on devrait comprendre où est le nord, est, sud... on va
// tout simplement mettre une flèche en direction de deux éléments. La piste
// de danse et les mariés. Et la ligne centrale. Comme ça, on comprend
// rapidement où est la table." Calcule, pour une table donnée, l'angle (en
// degrés, sens horaire depuis le haut -- même convention que
// components/TableSeatWheel.tsx) du vecteur allant de sa position réelle sur
// le plan de salle (components/FloorPlan.tsx) vers chacun des deux repères.
// Purement un habillage d'orientation sur le dessin "vu sur le plan
// photographié" -- ne dépend d'aucune donnée serveur, jamais une source de
// placement.

export interface TableOrientation {
  danseAngle: number;
  alleeAngle: number;
}

function angleToLandmark(tableX: number, tableY: number, landmark: [number, number]): number {
  const [lx, ly] = landmark;
  const dx = lx - tableX;
  const dy = ly - tableY;
  // atan2(dx, -dy) place 0° "en haut" (repère directement au-dessus de la
  // table) et augmente dans le sens horaire à mesure que le repère se
  // déplace vers la droite -- exactement la convention de rotation déjà
  // utilisée pour les sièges (rotate(angle, CENTER, CENTER)).
  const radians = Math.atan2(dx, -dy);
  const degrees = (radians * 180) / Math.PI;
  return (degrees + 360) % 360;
}

export function getTableOrientation(tableNumber: number): TableOrientation | null {
  const position = FLOOR_PLAN_TABLE_POSITIONS[tableNumber];
  if (!position) return null;
  const [x, y] = position;
  return {
    danseAngle: angleToLandmark(x, y, DANCE_FLOOR_LANDMARK),
    alleeAngle: angleToLandmark(x, y, CENTRAL_AISLE_LANDMARK),
  };
}
