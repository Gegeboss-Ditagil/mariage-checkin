import { NextRequest } from 'next/server';

/**
 * Reconstruit l'URL publique du déploiement courant depuis les en-têtes de
 * la requête -- fonctionne aussi bien en preview qu'en production, sans
 * variable d'environnement dédiée. Utilisé pour construire le lien
 * `/approve/[token]` envoyé par SMS/WhatsApp, et pour valider la signature
 * Twilio des webhooks entrants (qui porte sur l'URL exacte appelée).
 */
export function baseUrl(req: NextRequest): string {
  const fromHeader = req.headers.get('origin') || req.headers.get('x-forwarded-host');
  if (fromHeader) {
    return fromHeader.startsWith('http') ? fromHeader : 'https://' + fromHeader;
  }
  if (process.env.VERCEL_URL) return 'https://' + process.env.VERCEL_URL;
  return 'https://mariage-checkin.vercel.app';
}
