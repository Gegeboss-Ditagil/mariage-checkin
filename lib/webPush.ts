import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasCapability } from './permissions.ts';
import { logServerEvent } from './serverLog.ts';
import type { Role } from './types.ts';

// v1.48.3 : même correctif que lib/twilio.ts (TWILIO_REQUEST_TIMEOUT_MS) --
// ces envois Push sont best-effort (voir lib/guestApprovalDecide.ts et les
// routes d'approbation/assignation qui les appellent, toujours dans un
// `catch` ignoré), mais `webpush.sendNotification` sans option `timeout`
// pouvait rester bloqué sans limite en cas de endpoint push lent/injoignable
// -- retour de Gersom : "les trois petits points restent là très longtemps"
// en approuvant. Borné à 8s comme pour Twilio.
const PUSH_REQUEST_TIMEOUT_MS = 8000;

function configure(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@mariage-checkin.local';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

// Clés VAPID absentes de Vercel = aucun Push possible (cas réel constaté le
// 12/10/2026 : 0 abonnement). On le trace au lieu de se taire.
async function ensureConfigured(eventId: string): Promise<boolean> {
  if (configure()) return true;
  await logServerEvent({ event_id: eventId, level: 'warn', path: 'lib/webPush', message: 'Push non configuré : VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absentes' });
  return false;
}

export function webPushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}


export interface PushSubscriptionRow { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }
export type PushSender = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  options: { timeout: number }
) => Promise<unknown>;

// v1.83.0 : envoi commun aux deux notifications. Un abonnement expiré (404/410)
// est supprimé ; tout AUTRE échec (clé VAPID invalide, service Push injoignable…)
// était avalé sans trace -- c'est ce qui a laissé « 0 abonnement, jamais testé »
// passer inaperçu. Il est maintenant journalisé (app_logs, niveau warn) sans
// jamais bloquer la décision. Retourne le nombre d'envois réussis.
export async function deliverPush(
  supabase: SupabaseClient,
  eventId: string,
  subscriptions: PushSubscriptionRow[],
  payload: string,
  sender: PushSender = (sub, body, options) => webpush.sendNotification(sub, body, options)
): Promise<number> {
  let sent = 0;
  await Promise.allSettled(subscriptions.map(async (item) => {
    try {
      await sender({ endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } }, payload, { timeout: PUSH_REQUEST_TIMEOUT_MS });
      sent += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', item.id);
        return;
      }
      await logServerEvent({
        event_id: eventId,
        level: 'warn',
        path: 'lib/webPush',
        message: `Échec d'envoi Push (${statusCode ?? 'sans code'})`,
        context: { subscription_id: item.id, status_code: statusCode ?? null, detail: String((error as Error)?.message || error).slice(0, 300) },
      });
    }
  }));
  return sent;
}

export async function notifyGuestApprovalReviewers(
  supabase: SupabaseClient,
  request: { id: string; event_id: string; nom_invite: string; cote: string; nombre_invites: number },
  sender?: PushSender
): Promise<void> {
  if (!(await ensureConfigured(request.event_id))) return;
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .eq('event_id', request.event_id);
  if (!subscriptions?.length) return;
  const userIds = Array.from(new Set(subscriptions.map((item) => item.user_id)));
  const { data: users } = await supabase.from('users').select('id, role, active').in('id', userIds).eq('active', true);
  const allowed = new Set((users || []).filter((user) => hasCapability(user.role as Role, 'reviewGuestApproval')).map((user) => user.id));
  // v1.48.4, demande de Gersom : "le petit 1 indicateur sur l'icône avant de
  // l'ouvrir" -- badge numérique sur l'icône de l'app (écran d'accueil),
  // distinct du champ `badge` de showNotification ci-dessous (une simple
  // icône monochrome, jamais un nombre). Même compte que `pending_count`
  // (`GET /api/guest-approvals?count=pending`, déjà affiché à l'intérieur de
  // l'app) -- le service worker (`public/sw.js`) lit `badgeCount` sur
  // réception du push et appelle `navigator.setAppBadge` en tâche de fond,
  // avant même que l'app soit ouverte (voir lib/appBadge.ts pour la même
  // logique côté client, en premier plan).
  const { count: badgeCount } = await supabase
    .from('guest_approval_requests')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', request.event_id)
    .eq('statut', 'en_attente');
  const payload = JSON.stringify({
    title: 'Approbation en attente',
    body: `${request.nom_invite} · ${request.nombre_invites} · Côté ${request.cote === 'Gege' ? 'Gégé' : 'Nelly'}`,
    url: `/approbations?request=${request.id}`,
    tag: `guest-approval-${request.id}`,
    badgeCount: badgeCount ?? 0,
  });
  await deliverPush(supabase, request.event_id, subscriptions.filter((item) => allowed.has(item.user_id)), payload, sender);
}

export async function notifyGuestApprovalPlaceurs(
  supabase: SupabaseClient,
  request: { id: string; event_id: string; nom_invite: string; nombre_invites: number },
  tableNumber: number | null,
  sender?: PushSender
): Promise<void> {
  if (!(await ensureConfigured(request.event_id))) return;
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .eq('event_id', request.event_id);
  if (!subscriptions?.length) return;
  const userIds = Array.from(new Set(subscriptions.map((item) => item.user_id)));
  const { data: users } = await supabase.from('users').select('id, role, active').in('id', userIds).eq('active', true);
  const placeurs = new Set((users || []).filter((user) => user.role === 'placeur').map((user) => user.id));
  const payload = JSON.stringify({
    title: tableNumber ? 'Invité approuvé et placé' : 'Invité approuvé — table requise',
    body: tableNumber
      ? `${request.nom_invite} (${request.nombre_invites}) · Table ${tableNumber}`
      : `${request.nom_invite} (${request.nombre_invites}) attend à la porte · assignez une table`,
    url: tableNumber ? '/approbations' : `/approbations/${request.id}/assign`,
    tag: `guest-approval-placeur-${request.id}`,
  });
  await deliverPush(supabase, request.event_id, subscriptions.filter((item) => placeurs.has(item.user_id)), payload, sender);
}
