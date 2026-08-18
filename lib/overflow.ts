import { TableRow } from './types';

export interface ReserveTableUsage {
  table: TableRow;
  used: number;
  available: number;
}

/**
 * Propose la meilleure table de reserve pour un nombre de personnes donne :
 * la table avec le moins de places libres qui suffit quand meme (pour remplir
 * les tables progressivement plutot que de les eparpiller).
 */
export function proposeReserveTable(
  usages: ReserveTableUsage[],
  nombrePersonnes: number
): ReserveTableUsage | null {
  const candidates = usages
    .filter((u) => u.available >= nombrePersonnes)
    .sort((a, b) => a.available - b.available);
  return candidates[0] ?? null;
}
