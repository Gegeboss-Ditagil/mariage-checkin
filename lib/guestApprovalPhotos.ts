import type { SupabaseClient } from '@supabase/supabase-js';

export const GUEST_APPROVAL_BUCKET = 'guest-approval-photos';

// URL signée valable 1h -- largement suffisant pour consulter/décider
// (page publique) ou pour l'écran /approbations (staff) ; jamais de bucket
// public (voir migration 0032), jamais SUPABASE_SERVICE_ROLE_KEY exposée au
// client : seul le chemin + l'URL signée, générés ici côté serveur, sortent
// de cette fonction.
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_URL_CACHE_MS = 50 * 60 * 1000;

// Cache uniquement en memoire du processus serveur : aucune URL privee n'est
// ecrite en base, dans un fichier ou dans un cache public. Une instance Vercel
// chaude reutilise la meme URL pendant 50 minutes; une nouvelle instance
// regenere simplement le lot. Cela evite surtout un appel Storage par photo a
// chaque rafraichissement de /approbations.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

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
    .upload(path, buffer, { contentType: file.type || 'image/jpeg', cacheControl: '86400', upsert: false });
  if (error) throw new Error('upload_failed: ' + error.message);
  return path;
}

export async function getSignedPhotoUrl(supabase: SupabaseClient, path: string): Promise<string | null> {
  const urls = await getSignedPhotoUrls(supabase, [path]);
  return urls.get(path) ?? null;
}

/** Signe toutes les photos manquantes en une seule requete Storage. */
export async function getSignedPhotoUrls(
  supabase: SupabaseClient,
  paths: string[]
): Promise<Map<string, string | null>> {
  const now = Date.now();
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  const result = new Map<string, string | null>();
  const missing: string[] = [];

  for (const path of uniquePaths) {
    const cached = signedUrlCache.get(path);
    if (cached && cached.expiresAt > now) result.set(path, cached.url);
    else missing.push(path);
  }

  if (missing.length > 0) {
    const { data, error } = await supabase.storage
      .from(GUEST_APPROVAL_BUCKET)
      .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);

    if (error || !data) {
      for (const path of missing) result.set(path, null);
    } else {
      for (const item of data) {
        if (!item.path) continue;
        const url = item.signedUrl ?? null;
        result.set(item.path, url);
        if (url) signedUrlCache.set(item.path, { url, expiresAt: now + SIGNED_URL_CACHE_MS });
      }
      for (const path of missing) if (!result.has(path)) result.set(path, null);
    }
  }

  return result;
}
