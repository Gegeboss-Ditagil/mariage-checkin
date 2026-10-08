import type { GuestApprovalRequestRow } from './types';

// v1.73.0 (QA terrain) : `token` est le secret du lien public
// /approve/[token] envoye a l'approbateur. Il etait renvoye tel quel a
// l'agent qui cree la demande (placeur) par POST /api/guest-approvals, et a
// quiconque reserve une table (placeur aussi) : un placeur pouvait donc
// ouvrir ce lien et approuver sa propre demande, sans jamais avoir
// `reviewGuestApproval`. Le numero de l'approbateur n'a pas non plus a
// quitter le serveur. Toute reponse JSON contenant une ligne
// guest_approval_requests passe par cette fonction.
export type PublicGuestApprovalRequest<T extends Partial<GuestApprovalRequestRow>> = Omit<T, 'token' | 'approver_phone'>;

export function withoutApprovalSecrets<T extends Partial<GuestApprovalRequestRow>>(row: T): PublicGuestApprovalRequest<T> {
  const { token: _token, approver_phone: _phone, ...rest } = row;
  return rest;
}

/** Variante pour un resultat de applyGuestApprovalDecision ({ ok, request? }). */
export function decisionResultWithoutSecrets<R extends { request?: Partial<GuestApprovalRequestRow> }>(result: R): R {
  if (!result.request) return result;
  return { ...result, request: withoutApprovalSecrets(result.request) } as R;
}
