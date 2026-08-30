import { createHmac, timingSafeEqual } from 'node:crypto';

// Envoi de SMS/WhatsApp via l'API REST Twilio directement en fetch() -- pas
// de SDK `twilio` ajouté en dépendance : quelques appels HTTP simples (Basic
// Auth + corps form-encodé), pas besoin d'un client complet pour ça.
//
// IMPORTANT (voir supabase/migrations/0032_guest_approvals.sql) : un numéro
// Twilio français ne supporte PAS l'envoi de MMS -- seuls les numéros
// US/Canada le permettent. sendSms n'envoie donc JAMAIS de média (pas de
// paramètre MediaUrl) : uniquement du texte, avec un lien vers la page
// publique /approve/[token] qui affiche la photo à l'ouverture.
//
// Canal WhatsApp (v1.27.0, migration 0034) : ajouté en plus du SMS -- "au
// cas où [l'approbateur] n'a pas de réseau [cellulaire] et est connecté au
// wifi" (demande de Gersom). Un message WhatsApp initié par l'app (hors
// fenêtre de session de 24h) DOIT utiliser un Content Template pré-approuvé
// par Meta (ContentSid) -- pas de texte libre possible, contrairement au SMS.

export class TwilioConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TwilioConfigError';
  }
}

export class TwilioSendError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'TwilioSendError';
    this.status = status;
    this.body = body;
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

// WhatsApp a son propre numéro expéditeur (souvent le même numéro Twilio que
// le SMS, mais pas obligatoirement -- sandbox ou sender WhatsApp Business
// dédié) et son Content Template approuvé : deux variables séparées de
// TWILIO_PHONE_NUMBER, absentes = canal WhatsApp desactivé silencieusement
// (voir sendWhatsApp), jamais une erreur qui bloquerait le SMS.
function getWhatsAppConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
}

async function postMessage(
  accountSid: string,
  authToken: string,
  params: Record<string, string>
): Promise<void> {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
    },
    body: new URLSearchParams(params).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new TwilioSendError(`Twilio a refusé l'envoi (${res.status})`, res.status, text);
  }
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
  await postMessage(accountSid, authToken, { To: to, From: from, Body: body });
}

/**
 * Envoie un message WhatsApp via un Content Template approuvé (jamais de
 * texte libre pour un message initié par l'app -- Meta l'exige hors fenêtre
 * de session de 24h). `contentVariables` est un objet `{ "1": "...", "2":
 * "..." }` correspondant aux variables `{{1}}`/`{{2}}`/... définies dans le
 * template côté console Twilio.
 *
 * Retourne SANS RIEN FAIRE (pas d'exception) si TWILIO_WHATSAPP_NUMBER ou
 * `contentSid` sont absents : le canal WhatsApp est un complément au SMS,
 * jamais une condition bloquante -- voir lib/guestApprovalNotify.ts.
 */
export async function sendWhatsApp(
  to: string,
  contentSid: string | undefined,
  contentVariables?: Record<string, string>
): Promise<void> {
  const config = getWhatsAppConfig();
  if (!config || !contentSid) return;

  const params: Record<string, string> = {
    To: 'whatsapp:' + to,
    From: 'whatsapp:' + config.from,
    ContentSid: contentSid,
  };
  if (contentVariables && Object.keys(contentVariables).length > 0) {
    params.ContentVariables = JSON.stringify(contentVariables);
  }
  await postMessage(config.accountSid, config.authToken, params);
}

/**
 * Valide qu'une requête webhook entrante (ex. réponse WhatsApp de
 * l'approbateur) vient bien de Twilio -- algorithme officiel : HMAC-SHA1 de
 * l'URL complète concaténée aux paires clé+valeur du POST triées par clé,
 * encodé en base64, comparé en temps constant à l'en-tête
 * `X-Twilio-Signature`. Sans authToken configuré, refuse tout (fail closed)
 * -- jamais de webhook accepté "par défaut" sans pouvoir le vérifier.
 */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signatureHeader: string | null
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken || !signatureHeader) return false;

  const data =
    url +
    Object.keys(params)
      .sort()
      .map((key) => key + params[key])
      .join('');

  const expected = createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
