import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasCapability } from '@/lib/permissions';
import type { Role } from '@/lib/types';

function configure(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@mariage-checkin.local';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export function webPushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export async function notifyGuestApprovalReviewers(
  supabase: SupabaseClient,
  request: { id: string; event_id: string; nom_invite: string; cote: string; nombre_invites: number }
): Promise<void> {
  if (!configure()) return;
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .eq('event_id', request.event_id);
  if (!subscriptions?.length) return;
  const userIds = Array.from(new Set(subscriptions.map((item) => item.user_id)));
  const { data: users } = await supabase.from('users').select('id, role, active').in('id', userIds).eq('active', true);
  const allowed = new Set((users || []).filter((user) => hasCapability(user.role as Role, 'reviewGuestApproval')).map((user) => user.id));
  const payload = JSON.stringify({
    title: 'Approbation en attente',
    body: `${request.nom_invite} · ${request.nombre_invites} · Côté ${request.cote === 'Gege' ? 'Gégé' : 'Nelly'}`,
    url: '/approbations',
    tag: `guest-approval-${request.id}`,
  });
  await Promise.allSettled(subscriptions.filter((item) => allowed.has(item.user_id)).map(async (item) => {
    try {
      await webpush.sendNotification({ endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } }, payload);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) await supabase.from('push_subscriptions').delete().eq('id', item.id);
    }
  }));
}
