// Petit pont entre /tables/[tableId] (selection multiple) et
// /tables/move-multiple (choix de la table de destination), et entre les
// deux moitiees d'un echange (table A -> table B). sessionStorage suffit :
// c'est un parcours en 2-3 ecrans dans le meme onglet, jamais partage entre
// appareils ni persistant au-dela de la session.

export type BulkMoveMode = 'transfer' | 'exchange-pick-b';

export interface BulkMoveSelection {
  invitationIds: string[];
  fromTableId: string;
  mode: BulkMoveMode;
}

const KEY = 'mariage_bulk_move_v1';

export function saveBulkMoveSelection(selection: BulkMoveSelection) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(selection));
  } catch {
    // sessionStorage indisponible (navigation privee stricte, quota...) --
    // le parcours echouera proprement a l'etape suivante (selection vide),
    // pas de crash.
  }
}

export function readBulkMoveSelection(): BulkMoveSelection | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      !Array.isArray(parsed.invitationIds) ||
      parsed.invitationIds.length === 0 ||
      typeof parsed.fromTableId !== 'string' ||
      (parsed.mode !== 'transfer' && parsed.mode !== 'exchange-pick-b')
    ) {
      return null;
    }
    return parsed as BulkMoveSelection;
  } catch {
    return null;
  }
}

export function clearBulkMoveSelection() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // rien a faire si sessionStorage est indisponible
  }
}
