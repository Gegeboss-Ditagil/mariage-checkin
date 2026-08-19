import { TableCapacity } from './capacity';

/**
 * Propose la meilleure table pour un nombre de personnes donne parmi celles
 * qui ont assez de place ESTIMEE (capacite - occupation estimee, qui tient
 * compte des invitations marquees "ne viendra pas" -- voir lib/capacity.ts).
 * Priorise les tables de reserve (c'est leur role), puis parmi les
 * candidates restantes, celle avec le moins de places libres qui suffit
 * quand meme (pour remplir les tables progressivement plutot que de les
 * eparpiller). Une table normale reste proposable si aucune table de
 * reserve ne convient.
 */
export function proposeReserveTable(
  usages: TableCapacity[],
  nombrePersonnes: number
): TableCapacity | null {
  const candidates = usages
    .filter((u) => u.libresEstimees >= nombrePersonnes)
    .sort((a, b) => {
      if (a.table.is_reserve !== b.table.is_reserve) return a.table.is_reserve ? -1 : 1;
      return a.libresEstimees - b.libresEstimees;
    });
  return candidates[0] ?? null;
}

