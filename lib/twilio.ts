// Envoi de SMS via l'API REST Twilio directement en fetch() -- pas de SDK
// `twilio` ajouté en dépendance : un seul appel HTTP simple (Basic Auth +
// corps form-encodé), pas besoin d'un client complet pour ça.
//
// IMPORTANT (voir supabase/migrations/0032_guest_approvals.sql) : un numéro
// Twilio français ne supporte PAS l'envoi de MMS -- seuls les numéros
// US/Canada le permettent. Cette fonction n'envoie donc JAMAIS de média
// (pas de paramètre MediaUrl) : uniquement du texte, avec un lien vers la
// page publique /approve/[token] qui affiche la photo à l'ouverture.

export class TwilioConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TwilioConfigError';
  }
}

export class TwilioSendError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string
  ) {
    super(message);
    this.name = 'TwilioSendError';
  }
}

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !from) {
    throw new TwilioConfigError(
      'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_PHONE_NUMBER doivent être définis (Vercel → Settings → Environment Variables)'
    );
  }
  return { accountSid, authToken, from };
}

/**
 * Envoie un SMS texte seul (jamais de MMS, voir note en tête de fichier).
 * Lève TwilioConfigError si les variables d'environnement sont absentes,
 * TwilioSendError si Twilio refuse l'envoi (numéro invalide, solde
 * insuffisant, etc.) -- l'appelant décide s'il doit bloquer l'action
 * globale ou juste avertir l'agent que le SMS n'est pas parti (voir
 * app/api/guest-approvals/route.ts : la demande est créée même si le SMS
 * échoue, pour ne jamais perdre la photo/les infos déjà saisies).
 */
export async function sendSms(to: string, body: string): Promise<void> {
  const { accountSid, authToken, from } = getTwilioConfig();

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new TwilioSendError(`Twilio a refusé l'envoi du SMS (${res.status})`, res.status, text);
  }
}
