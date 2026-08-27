export interface DraftMember {
  key: string;
  prenom: string;
  nom: string;
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
