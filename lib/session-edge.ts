// Verification de session compatible avec l'Edge Runtime (Web Crypto),
// utilisee UNIQUEMENT par le middleware (qui tourne obligatoirement sur
// Edge Runtime avec Next.js 14, incompatible avec le module Node "crypto").
//
// La creation du token (login) et toute la logique cote API continuent
// d'utiliser lib/auth.ts (Node "crypto", scrypt inclus) — les deux
// implementations HMAC-SHA256 sont interoperables car c'est un standard :
// un token cree par auth.ts est verifiable ici, et inversement.
import { SessionUser } from './types';

const SESSION_COOKIE_NAME = 'wc_session';

function base64urlToBytes(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hexToBytes(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes.buffer;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET manquant dans les variables d\'environnement');
  }
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(new TextEncoder().encode(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

export async function verifySessionTokenEdge(
  token: string | undefined | null
): Promise<SessionUser | null> {
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  try {
    const key = await getKey();
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      hexToBytes(signature),
      toArrayBuffer(new TextEncoder().encode(encoded))
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(toArrayBuffer(base64urlToBytes(encoded))));
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

export { SESSION_COOKIE_NAME };
