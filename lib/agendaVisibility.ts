// v1.82.5 : filtre de visibilité de l'agenda, extrait de GET /api/agenda pour
// pouvoir le tester. Un rôle sans manageAgenda (agent scan, placeur,
// approbateur) ne reçoit JAMAIS une ligne privée (0058) : filtrage côté
// serveur, jamais un masquage côté client qui laisserait fuiter le contenu
// (aérodrome, hélicoptère, convoi VIP…) dans la réponse réseau.
export function visibleAgendaItems<T extends { is_private?: unknown }>(items: T[], canManage: boolean): T[] {
  return canManage ? items : items.filter((item) => item.is_private !== true);
}
