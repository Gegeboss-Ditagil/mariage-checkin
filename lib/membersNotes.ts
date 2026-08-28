export interface DraftMember {
  key: string;
  prenom: string;
  nom: string;
}

export function extractPrenoms(notes: string | null): string | null {
  if (!notes) return null;
  const marker = 'Membres:';
  const idx = notes.indexOf(marker);
  if (idx === -1) return null;
  const after = notes.slice(idx + marker.length).trim();
  if (!after) return null;
  const noms = after
    .split(',')
    .map((part) => part.trim().split(' ')[0])
    .filter(Boolean);
  return noms.length > 0 ? noms.join(', ') : null;
}

export function extractMembresComplet(notes: string | null): string[] {
  if (!notes) return [];
  const marker = 'Membres:';
  const idx = notes.indexOf(marker);
  if (idx === -1) return [];
  const after = notes.slice(idx + marker.length).trim();
  if (!after) return [];
  return after.split(',').map((part) => part.trim()).filter(Boolean);
}

let draftKeyCounter = 0;

export function newDraftKey(): string {
  draftKeyCounter += 1;
  return 'd' + draftKeyCounter;
}

/** Extrait une suggestion modifiable depuis le texte libre
 * "Membres: A B, C D" des imports existants. */
export function parseMembersFromNotes(notes: string | null): DraftMember[] {
  if (!notes) return [];
  const marker = 'Membres:';
  const idx = notes.indexOf(marker);
  if (idx === -1) return [];
  const after = notes.slice(idx + marker.length).trim();
  if (!after) return [];
  return after
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((full) => {
      const spaceIdx = full.indexOf(' ');
      if (spaceIdx === -1) return { key: newDraftKey(), prenom: full, nom: '' };
      return { key: newDraftKey(), prenom: full.slice(0, spaceIdx), nom: full.slice(spaceIdx + 1) };
    });
}
