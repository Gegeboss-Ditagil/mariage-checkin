import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'crypto';
import { SessionUser } from './types';

// ---------------------------------------------------------------------------
// Hachage de mot de passe / PIN (scrypt, stdlib Node — pas de dependance
// externe necessaire, contrairement a bcrypt).
// ---------------------------------------------------------------------------
export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(secret, salt, 64).toString('hex');
  return salt + ':' + hash;
}

export function verifySecret(secret: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, 'hex');
  const candidate = scryptSync(secret, salt, 64);
  if (candidate.length !== hashBuffer.length) return false;
  return timingSafeEqual(candidate, hashBuffer);
}

// ---------------------------------------------------------------------------
// Session : cookie httpOnly signe (HMAC) contenant l'utilisateur + expiration.
// Pas de JWT externe necessaire — implementation minimale et auditable.
//
// Une session expire apres 12 h. Elle contient aussi l'identifiant du
// deploiement Vercel courant : apres un nouveau deploiement, les anciennes
// sessions deviennent automatiquement invalides et le middleware force une
// reconnexion propre au lieu de laisser une vieille version de l'app tourner.
// ---------------------------------------------------------------------------
const SESSION_COOKIE_NAME = 'wc_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET manquant dans les variables d\'environnement');
  }
  return secret;
}

function getSessionVersion(): string {
  return (
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    'local'
  );
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

export function createSessionToken(user: SessionUser): string {
  const payload = JSON.stringify({
    ...user,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    ver: getSessionVersion(),
  });
  const encoded = Buffer.from(payload).toString('base64url');
  const signature = sign(encoded);
  return encoded + '.' + signature;
}

export function verifySessionToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expBuffer.length || !timingSafeEqual(sigBuffer, expBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    if (payload.ver !== getSessionVersion()) return null;
    return {
      id: payload.id,
      nom_affichage: payload.nom_affichage,
      nom_complet: payload.nom_complet ?? null,
      role: payload.role,
      event_id: payload.event_id,
    };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS };
