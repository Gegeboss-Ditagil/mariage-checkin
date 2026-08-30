import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSignedPhotoUrl } from '@/lib/guestApprovalPhotos';
import { GuestApprovalRequestRow } from '@/lib/types';

/**
 * Route PUBLIQUE (voir middleware.ts, préfixe /api/public) -- sans
 * connexion, ouverte via le lien SMS /approve/[token]. La connaissance du
 * token EST l'autorisation : ne renvoie que les champs nécessaires à
 * l'affichage, jamais approver_phone/requested_by/token lui-même, et
 * résout la photo en URL signée côté serveur (client Supabase admin) --
 * SUPABASE_SERVICE_ROLE_KEY ne quitte jamais ce fichier serveur.
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: request } = await supabase
    .from('guest_approval_requests')
    .select('*')
    .eq('token', token)
    .maybeSingle<GuestApprovalRequestRow>();

  if (!request) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const signedUrl = await getSignedPhotoUrl(supabase, request.photo_url);

  return NextResponse.json({
    cote: request.cote,
    nom_invite: request.nom_invite,
    nombre_invites: request.nombre_invites,
    statut: request.statut,
    photo_signed_url: signedUrl,
    created_at: request.created_at,
  });
}
