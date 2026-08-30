import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateTwilioSignature } from '@/lib/twilio';
import { applyGuestApprovalDecision } from '@/lib/guestApprovalDecide';
import { baseUrl } from '@/lib/requestUrl';

/**
 * Webhook PUBLIC Twilio (à configurer comme "A message comes in" sur le
 * numéro WhatsApp, console Twilio) -- reçoit la réponse texte libre de
 * l'approbateur ("Oui"/"O"/"Y" ou "Non"/"N") à la demande envoyée par
 * notifyApprover (lib/guestApprovalNotify.ts). Demande de Gersom le
 * 30/08/2026 : "propose un template propre pour recevoir la réponse...
 * en répondant O ou Y ou N".
 *
 * Pas de session ni de token dans une réponse WhatsApp en texte libre --
 * l'authenticité de la requête est garantie par la signature Twilio
 * (X-Twilio-Signature, voir lib/twilio.ts) plutôt que par une session ou un
 * secret dans l'URL. La demande concernée est retrouvée par numéro de
 * téléphone (la plus récente encore `en_attente` pour ce numéro, voir
 * lib/guestApprovalDecide.ts) puisqu'un simple "Oui" ne porte aucun
 * identifiant de demande.
 */

function parseDecision(bodyText: string): 'approuve' | 'refuse' | null {
  // Enleve les accents (meme idiome que la normalisation de code QR dans
  // app/scan/page.tsx) : "Oui" et "Oui" repondent tous deux, par exemple.
  const normalized = bodyText
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (['oui', 'o', 'y', 'yes', '1', '👍'].includes(normalized)) return 'approuve';
  if (['non', 'n', 'no', '0', '👎'].includes(normalized)) return 'refuse';
  return null;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function twiml(message: string): NextResponse {
  const xml = '<?xml version="1.0" encoding="UTF-8"?><Response><Message>' + escapeXml(message) + '</Message></Response>';
  return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const parsed = new URLSearchParams(rawBody);
  const params: Record<string, string> = {};
  for (const [key, value] of parsed.entries()) params[key] = value;

  const signature = req.headers.get('x-twilio-signature');
  const url = baseUrl(req) + '/api/public/twilio/whatsapp-inbound';
  if (!validateTwilioSignature(url, params, signature)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 403 });
  }

  const from = (params.From || '').replace(/^whatsapp:/, '');
  const bodyText = params.Body || '';
  if (!from) {
    return twiml('Numéro non reconnu.');
  }

  const decision = parseDecision(bodyText);
  if (!decision) {
    return twiml("Répondez OUI ou NON pour répondre à la demande d'invité surprise en attente.");
  }

  const supabase = createAdminClient();
  const result = await applyGuestApprovalDecision(supabase, { phoneMostRecentPending: from }, decision, 'whatsapp');

  if (!result.ok) {
    return twiml("Aucune demande d'invité surprise en attente pour ce numéro en ce moment.");
  }

  const label = decision === 'approuve' ? 'approuvée ✅' : 'refusée ❌';
  return twiml('Merci ! La demande pour ' + result.request.nom_invite + ' a été ' + label + '.');
}
