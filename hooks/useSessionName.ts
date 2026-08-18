'use client';

import { useEffect, useState } from 'react';

/**
 * Recupere le nom complet de l'utilisateur connecte cote client, en lisant un
 * cookie NON httpOnly dedie (wc_name) pose au login — separe du cookie de
 * session signe (httpOnly) qui reste inaccessible en JS pour des raisons de
 * securite. Sert a afficher "Connecte : Prenom Nom" en haut de l'app.
 */
export function useSessionName(): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )wc_name=([^;]+)/);
    if (match) setName(decodeURIComponent(match[1]));
  }, []);

  return name;
}
