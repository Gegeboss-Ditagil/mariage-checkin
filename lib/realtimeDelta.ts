/**
 * Applique un evenement `postgres_changes` Realtime DIRECTEMENT sur une liste
 * deja chargee a l'ecran, au lieu de re-telecharger toute la table.
 *
 * Le jour J, le cas le plus frequent est un UPDATE d'une seule invitation
 * (record_checkin) : le payload recu fait ~1 Ko et contient LA ligne modifiee.
 * Recharger les 400 invitations a chaque fois revenait a ~100-300 Ko par
 * evenement multiplie par toutes les tablettes ouvertes sur le meme ecran.
 *
 * Politique d'usage dans les pages :
 *   - UPDATE  -> mise a jour locale via cette fonction (chemin chaud),
 *   - INSERT / DELETE -> rechargement debounce complet (rapide) : ce sont les
 *     imports CSV / corrections en lot, rares mais touffus.
 */
export type RealtimeRowDelta = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

export interface RealtimeRow {
  id: string;
}

/**
 * Insere ou remplace par id (upsert). Retourne toujours un NOUVEAU tableau
 * pour declarencher le re-rendu React proprement.
 */
export function upsertRow<T extends RealtimeRow>(list: T[], row: T): T[] {
  const exists = list.some((existing) => existing.id === row.id);
  if (!exists) return [...list, row];
  return list.map((existing) => (existing.id === row.id ? row : existing));
}

/** Retire une ligne par id (nouveau tableau). */
export function removeRow<T extends RealtimeRow>(list: T[], id: string): T[] {
  return list.filter((existing) => existing.id !== id);
}

/**
 * Remplace une ligne par id (uniquement si elle existe deja) -- l'UPDATE
 * d'une ligne inconnue (ex: deja filtree hors de l'ecran) ne doit jamais
 * l'ajouter par surprise.
 */
export function replaceRow<T extends RealtimeRow>(list: T[], row: T): T[] {
  if (!list.some((existing) => existing.id === row.id)) return list;
  return list.map((existing) => (existing.id === row.id ? row : existing));
}

/** Applique INSERT/UPDATE/DELETE sur une liste idempotente. */
export function applyRowDelta<T extends RealtimeRow>(
  list: T[],
  payload: RealtimeRowDelta
): T[] {
  if (payload.eventType === 'DELETE') {
    const deleted = (payload.old as T | null) ?? null;
    return deleted ? removeRow(list, deleted.id) : list;
  }
  if (payload.eventType === 'INSERT' && payload.new) {
    return upsertRow(list, payload.new as T);
  }
  if (payload.eventType === 'UPDATE' && payload.new) {
    return replaceRow(list, payload.new as T);
  }
  return list;
}