import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';
import { uploadGuestApprovalPhoto, getSignedPhotoUrl } from '@/lib/guestApprovalPhotos';
import { notifyApprover } from '@/lib/guestApprovalNotify';
import { GuestApprovalRequestRow, GuestApproverRow } from '@/lib/types';
import { TwilioConfigError, TwilioSendError } from '@/lib/twilio';

/**
 * Invité surprise avec approbation SMS à distance (v1.27.0) -- demande de
 * Gersom : bouton sur /scan, réservé à admin/directeur/placeur (capacité
 * guestApproval, JAMAIS agent_checkin ni visibilite -- "si le scanner voit
 * des personnes en plus, il ne fait rien, il va voir le placeur"). Voir
 * supabase/migrations/0032_guest_approvals.sql pour le schéma complet.
 */

function baseUrl(req: NextRequest): string {
  // Vercel expose l'URL du déploiement courant -- fonctionne aussi bien en
  // preview qu'en production, sans variable d'environnement dédiée.
  const fromHeader = req.headers.get('origin') || req.headers.get('x-forwarded-host');
  if (fromHeader) {
    return fromHeader.startsWith('http') ? fromHeader : 'https://' + fromHeader;
  }
  if (process.env.VERCEL_URL) return 'https://' + process.env.VERCEL_URL;
  return 'https://mariage-checkin.vercel.app';
}

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'guestApproval')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  const photo = form.get('photo');
  const cote = form.get('cote');
  const nomInvite = typeof form.get('nom_invite') === 'string' ? String(form.get('nom_invite')).trim() : '';
  const nombreInvitesRaw = Number(form.get('nombre_invites'));
  const nombreInvites = Number.isFinite(nombreInvitesRaw) && nombreInvitesRaw > 0 ? Math.floor(nombreInvitesRaw) : 1;

  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: 'photo_required' }, { status: 400 });
  }
  if (cote !== 'Nelly' && cote !== 'Gege') {
    return NextResponse.json({ error: 'invalid_cote' }, { status: 400 });
  }
  if (!nomInvite) {
    return NextResponse.json({ error: 'nom_required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: approver } = await supabase
    .from('guest_approvers')
    .select('*')
    .eq('cote', cote)
    .maybeSingle<GuestApproverRow>();
  if (!approver) {
    return NextResponse.json({ error: 'approver_not_configured' }, { status: 400 });
  }

  const { data: event } = await supabase.from('events').select('id').limit(1).maybeSingle();
  if (!event) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 400 });
  }

  const requestId = randomUUID();
  let photoPath: string;
  try {
    photoPath = await uploadGuestApprovalPhoto(supabase, requestId, photo);
  } catch {
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 });
  }

  const token = randomBytes(32).toString('hex');

  const { data: created, error } = await supabase
    .from('guest_approval_requests')
    .insert({
      id: requestId,
      event_id: event.id,
      token,
      requested_by: user.id,
      cote,
      nom_invite: nomInvite,
      nombre_invites: nombreInvites,
      photo_url: photoPath,
      approver_phone: approver.telephone,
    })
    .select('*')
    .single<GuestApprovalRequestRow>();

  if (error || !created) {
    return NextResponse.json({ error: error?.message || 'insert_failed' }, { status: 500 });
  }

  // Le SMS peut échouer (Twilio non configuré, numéro invalide, solde...)
  // sans faire perdre la demande déjà enregistrée (photo + infos) : l'agent
  // est prévenu explicitement dans la réponse pour contacter l'approbateur
  // autrement le temps de résoudre le problème.
  let smsSent = true;
  let smsError: string | null = null;
  try {
    await notifyApprover(created, baseUrl(req) + '/approve/' + token);
  } catch (err) {
    smsSent = false;
    smsError =
      err instanceof TwilioConfigError
        ? 'Twilio non configuré (variables d\'environnement manquantes)'
        : err instanceof TwilioSendError
          ? "Twilio a refusé l'envoi (numéro invalide ?)"
          : 'Erreur inconnue';
  }

  const signedUrl = await getSignedPhotoUrl(supabase, photoPath);

  return NextResponse.json({
    request: { ...created, photo_signed_url: signedUrl },
    approver_nom: approver.nom,
    sms_sent: smsSent,
    sms_error: smsError,
  });
}

export async function GET() {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'guestApproval')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('guest_approval_requests')
    .select(
      'id, cote, nom_invite, nombre_invites, photo_url, statut, decided_at, table_id, assigned_at, created_at, ' +
      'requested_by:requested_by(nom_affichage), table:table_id(number)'
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const requests = await Promise.all(
    (data || []).map(async (row: any) => ({
      id: row.id,
      cote: row.cote,
      nom_invite: row.nom_invite,
      nombre_invites: row.nombre_invites,
      statut: row.statut,
      decided_at: row.decided_at,
      table_id: row.table_id,
      table_number: row.table?.number ?? null,
      assigned_at: row.assigned_at,
      created_at: row.created_at,
      requested_by_nom: row.requested_by?.nom_affichage ?? null,
      photo_signed_url: await getSignedPhotoUrl(supabase, row.photo_url),
    }))
  );

  return NextResponse.json({ requests });
}
