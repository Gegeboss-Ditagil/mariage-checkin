import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, createSessionToken, verifySessionToken } from './auth';
import { createAdminClient } from './supabase/admin';
import { reconcileSession, type AccountState } from './sessionRefresh';
import { SessionUser } from './types';

// v1.78.0 : l'état du compte (rôle, actif) est relu en base, avec un petit
// cache par instance pour ne pas ajouter une requête à chaque appel.
const CACHE_MS = 3000;
const cache = new Map<string, { at: number; state: AccountState | null }>();

/** À appeler après avoir modifié un compte (rôle, actif) dans cette instance. */
export function forgetAccountState(userId: string) {
  cache.delete(userId);
}

async function accountState(userId: string): Promise<AccountState | null | undefined> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.state;
  try {
    const { data, error } = await createAdminClient()
      .from('users')
      .select('role, active, is_super_admin')
      .eq('id', userId)
      .maybeSingle();
    if (error) return undefined;
    const state = data ? { role: data.role, active: data.active, is_super_admin: data.is_super_admin === true } : null;
    cache.set(userId, { at: Date.now(), state });
    return state;
  } catch {
    return undefined;
  }
}

function writeCookies(user: SessionUser | null) {
  // Possible dans un Route Handler ; interdit (exception) dans un Server
  // Component : la session est alors corrigée à la prochaine requête d'API.
  try {
    const jar = cookies();
    const options = { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
    if (!user) {
      jar.set(SESSION_COOKIE_NAME, '', { ...options, httpOnly: true, maxAge: 0 });
      jar.set('wc_role', '', { ...options, maxAge: 0 });
      return;
    }
    jar.set(SESSION_COOKIE_NAME, createSessionToken(user), { ...options, httpOnly: true, maxAge: SESSION_MAX_AGE_SECONDS });
    jar.set('wc_role', user.role, { ...options, httpOnly: false, maxAge: SESSION_MAX_AGE_SECONDS });
  } catch {
    /* Server Component */
  }
}

/** A utiliser dans les Server Components / Route Handlers uniquement. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const user = verifySessionToken(token);
  if (!user) return null;
  const decision = reconcileSession(user, await accountState(user.id));
  if (decision.kind === 'revoke') {
    writeCookies(null);
    return null;
  }
  if (decision.kind === 'refresh') writeCookies(decision.user);
  return decision.user;
}

export function requireRole(user: SessionUser | null, roles: SessionUser['role'][]): boolean {
  return !!user && roles.includes(user.role);
}
