// v1.67.0, retour de Gersom (message vocal) : "rajouter un processus de
// sécurité pour ne pas qu'on puisse brute force les tentatives... maximum
// 10 tentatives de suite erronées... pour pas se faire pirater facilement,
// pour pas qu'il y ait quelqu'un qui nous sabote." Le PIN de connexion (4
// chiffres, 10 000 combinaisons) n'avait aucune limite de tentatives avant
// ce correctif -- brute-forçable en quelques minutes sans cette protection.
//
// Portée volontairement PAR COMPTE (nom_affichage), jamais par IP : la
// menace décrite ("un petit génie parmi les utilisateurs") est quelqu'un qui
// connaît déjà un nom valide et devine son PIN, pas un script qui pulvérise
// toute la liste des comptes -- un verrou par IP risquerait en plus de
// bloquer tout le staff d'un coup s'il partage le même Wi-Fi de la salle.
//
// Durée de verrouillage (15 min, confirmée explicitement par Gersom plutôt
// que devinée) : assez long pour décourager un brute-force manuel/scripté,
// assez court pour qu'un agent distrait un soir de mariage ne reste jamais
// bloqué durablement -- jamais un verrouillage permanent nécessitant une
// réinitialisation manuelle.
export const MAX_FAILED_LOGIN_ATTEMPTS = 10;
export const LOGIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export interface LoginLockoutState {
  failed_login_attempts: number;
  locked_until: string | null;
}

function lockoutExpired(state: LoginLockoutState): boolean {
  return !!state.locked_until && new Date(state.locked_until).getTime() <= Date.now();
}

export function isLockedOut(state: LoginLockoutState): boolean {
  return !!state.locked_until && !lockoutExpired(state);
}

export function lockoutRemainingMinutes(state: LoginLockoutState): number {
  if (!state.locked_until) return 0;
  const remainingMs = new Date(state.locked_until).getTime() - Date.now();
  return Math.max(1, Math.ceil(remainingMs / 60000));
}

// Calcule le prochain état (compteur + verrou) après une tentative échouée.
// Un verrou déjà expiré remet le compteur à zéro -- un agent qui a attendu
// la fin du verrouillage repart avec 10 tentatives fraîches, jamais une
// seule avant de se reverrouiller aussitôt.
export function nextStateAfterFailure(current: LoginLockoutState): {
  failed_login_attempts: number;
  locked_until: string | null;
  justLocked: boolean;
} {
  const baseAttempts = lockoutExpired(current) ? 0 : current.failed_login_attempts;
  const attempts = baseAttempts + 1;
  if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    return {
      failed_login_attempts: attempts,
      locked_until: new Date(Date.now() + LOGIN_LOCKOUT_DURATION_MS).toISOString(),
      justLocked: true,
    };
  }
  return { failed_login_attempts: attempts, locked_until: null, justLocked: false };
}

// Après une connexion réussie : toujours repartir de zéro.
export const RESET_LOCKOUT_STATE: { failed_login_attempts: number; locked_until: null } = {
  failed_login_attempts: 0,
  locked_until: null,
};
