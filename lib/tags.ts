// Etiquettes courantes proposees en un clic partout ou une invitation peut en
// recevoir (fiche /checkin/[invitationId], creation via /tables/add) -- voir
// 0022_manage_invitation_tags.sql pour les effets de bord automatiques sur
// `category`/`cote` (ex: SERVICES bascule category='Staff', visible ensuite
// par tout le monde sur /staff). N'importe quelle autre etiquette reste
// ajoutable via un champ texte libre la ou l'ecran le propose.
export const ETIQUETTES_RAPIDES: { value: string; label: string }[] = [
  { value: 'Côté_Gege', label: 'Côté Gege' },
  { value: 'Côté_Nelly', label: 'Côté Nelly' },
  { value: 'SERVICES', label: 'Staff' },
  { value: 'Photographe', label: 'Photographe' },
  { value: 'Prestataire', label: 'Prestataire' },
  { value: 'DJ_Animation', label: 'Animation (DJ)' },
  { value: 'notable', label: 'Sans table' },
];

export function libelleEtiquette(tag: string): string {
  return ETIQUETTES_RAPIDES.find((e) => e.value === tag)?.label ?? tag;
}
