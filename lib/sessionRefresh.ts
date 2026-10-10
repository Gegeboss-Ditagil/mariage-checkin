import type { Role, SessionUser } from './types.ts';

// v1.78.0, demande de Gersom : « que les admins puissent changer le rôle d'un
// user... et que ça fonctionne directement après ». Le rôle était figé dans
// le jeton de session (12 h) : un compte rétrogradé gardait ses anciens
// droits, un compte désactivé restait connecté. Désormais chaque requête
// serveur compare le jeton à l'état réel du compte (lib/session.ts).

export interface AccountState {
  role: Role;
  active: boolean;
  is_super_admin: boolean;
}

export type SessionDecision =
  | { kind: 'keep'; user: SessionUser }
  | { kind: 'refresh'; user: SessionUser }
  | { kind: 'revoke' };

/**
 * `state` = null : compte introuvable (supprimé) -> session révoquée.
 * `state` = undefined : base injoignable -> on garde le jeton (jamais
 * déconnecter tout le staff pendant une coupure de la base).
 */
export function reconcileSession(user: SessionUser, state: AccountState | null | undefined): SessionDecision {
  if (state === undefined) return { kind: 'keep', user };
  if (state === null || !state.active) return { kind: 'revoke' };
  // Passer à admin ou en sortir change le mode de connexion (email + mot de
  // passe contre nom + PIN) : on exige une nouvelle connexion plutôt que de
  // transformer silencieusement la session.
  if ((user.role === 'admin') !== (state.role === 'admin')) return { kind: 'revoke' };
  if (state.role !== user.role || state.is_super_admin !== (user.is_super_admin === true)) {
    return { kind: 'refresh', user: { ...user, role: state.role, is_super_admin: state.is_super_admin } };
  }
  return { kind: 'keep', user };
}
