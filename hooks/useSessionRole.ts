'use client';

import { useEffect, useState } from 'react';
import { Role } from '@/lib/types';

/**
 * Recupere le role de l'utilisateur connecte cote client, en lisant un cookie
 * NON httpOnly dedie (wc_role) pose au login — separe du cookie de session
 * signe (httpOnly) qui reste inaccessible en JS pour des raisons de securite.
 */
export function useSessionRole(): Role | null {
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )wc_role=([^;]+)/);
    if (match) setRole(decodeURIComponent(match[1]) as Role);
  }, []);

  return role;
}
