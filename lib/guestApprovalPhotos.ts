import type { SupabaseClient } from '@supabase/supabase-js';

export const GUEST_APPROVAL_BUCKET = 'guest-approval-photos';

// URL signée valable 1h -- largement suffisant pour consulter/décider
// (page publique) ou pour l'écran /approbations (staff) ; jamais de bucket
// public (voir migration 0032), jamais SUPABASE_SERVICE_ROLE_KEY exposée au
// client : seul le chemin + l'URL signée, générés ici côté serveur, sortent
// de cette fonction.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Upload la photo (reçue en multipart depuis /api/guest-approvals) dans le
 * bucket privé, sous un chemin imprévisible (uuid). Retourne le CHEMIN dans
 * le bucket (stocké tel quel dans guest_approval_requests.photo_url), pas
 * une URL -- voir getSignedPhotoUrl pour la résolution en URL signée.
 */
export async function uploadGuestApprovalPhoto(
  supabase: SupabaseClient,
  requestId: string,
  file: File
): Promise<string> {
  const ext = (file.type.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
  const path = requestId + '/' + crypto.randomUUID() + '.' + ext;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(GUEST_APPROVAL_BUCKET)
    .upload(path, buffer, { contentType: file.type || 'image/jpeg', upsert: false });
  if (error) throw new Error('upload_failed: ' + error.message);
  return path;
}

export async function getSignedPhotoUrl(supabase: SupabaseClient, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(GUEST_APPROVAL_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}
