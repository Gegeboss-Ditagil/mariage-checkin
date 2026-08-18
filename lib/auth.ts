import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'crypto';
import { SessionUser } from './types';

// ---------------------------------------------------------------------------
// Hachage de mot de passe / PIN (scrypt, stdlib Node — pas de dependance
// externe necessaire, contrairement a bcrypt).
// ---------------------------------------------------------------------------
export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(secret, salt, 64).toString('hex');
  return `${salt}:${hash}`;
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
// ---------------------------------------------------------------------------
const SESSION_COOKIE_NAME = 'wc_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 16; // 16h — largement assez pour une soiree

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET manquant dans les variables d\'environnement');
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

export function createSessionToken(user: SessionUser): string {
  const payload = JSON.stringify({ ...user, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 });
  const encoded = Buffer.from(payload).toString('base64url');
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
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
    return {
      id: payload.id,
      nom_affichage: payload.nom_affichage,
      role: payload.role,
      event_id: payload.event_id,
    };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS };
