import { InvitationStatut } from './types';

/**
 * Calcule le statut d'une invitation a partir du nombre prevu / arrive.
 * Doit rester en phase avec la fonction SQL record_checkin() (0002_functions.sql) —
 * cette version cote client sert uniquement a l'affichage optimiste, jamais a
 * la validation finale (qui est toujours faite cote serveur/DB).
 */
export function computeStatut(nombrePrevu: number, nombreArrive: number): InvitationStatut {
  if (nombreArrive <= 0) return 'non_arrive';
  if (nombreArrive < nombrePrevu) return 'partiel';
  if (nombreArrive === nombrePrevu) return 'complet';
  return 'excedent';
}

export function excedentCount(nombrePrevu: number, nombreArrive: number): number {
  return Math.max(0, nombreArrive - nombrePrevu);
}

export function restants(nombrePrevu: number, nombreArrive: number): number {
  return Math.max(0, nombrePrevu - nombreArrive);
}
