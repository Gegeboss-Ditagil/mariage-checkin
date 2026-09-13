import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';
import { GUEST_APPROVAL_BUCKET } from '@/lib/guestApprovalPhotos';

/**
 * Supprime une demande d'invité surprise déjà décidée (approuvée ou
 * refusée) -- demande de Gersom le 13/09/2026 : "il y a beaucoup de refusé
 * maintenant, la liste va s'étendre. Les administrateurs ont le droit de
 * faire un swipe pour les effacer." Réservé à `adminPanel` (admin
 * uniquement, comme le reste des opérations de nettoyage/administration),
 * jamais accessible à un demandeur ou un approbateur.
 *
 * Ne supprime JAMAIS une demande encore `en_attente` : un swipe accidentel
 * ne doit jamais faire disparaître une décision qui reste à prendre --
 * l'agent doit d'abord approuver ou refuser, puis seulement ensuite peut
 * la nettoyer de la liste.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'adminPanel')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('guest_approval_requests')
    .select('id, statut, photo_url')
    .eq('id', params.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (existing.statut === 'en_attente') {
    return NextResponse.json({ error: 'still_pending' }, { status: 409 });
  }

  const { error } = await supabase.from('guest_approval_requests').delete().eq('id', params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await supabase.from('audit_logs').insert({
    event_id: user.event_id,
    action: 'guest_approval_deleted',
    details: { request_id: existing.id, statut: existing.statut, deleted_by: user.id },
  });

  // Nettoyage best-effort de la photo -- ne fait jamais échouer la
  // suppression déjà actée en base si Storage est indisponible.
  if (existing.photo_url) {
    await supabase.storage.from(GUEST_APPROVAL_BUCKET).remove([existing.photo_url]).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
