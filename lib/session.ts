import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, verifySessionToken } from './auth';
import { SessionUser } from './types';

/** A utiliser dans les Server Components / Route Handlers uniquement. */
export function getSessionUser(): SessionUser | null {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function requireRole(user: SessionUser | null, roles: SessionUser['role'][]): boolean {
  return !!user && roles.includes(user.role);
}
