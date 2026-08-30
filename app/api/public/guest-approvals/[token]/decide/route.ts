import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getReserveRemaining, notifyApproverDecision } from '@/lib/guestApprovalNotify';
import { GuestApprovalRequestRow } from '@/lib/types';

/**
 * Route PUBLIQUE -- décision (Approuver/Refuser) depuis /approve/[token].
 * Un seul clic possible : l'update est gardé par `statut = 'en_attente'`
 * dans le WHERE, donc atomique (verrouillage de ligne implicite Postgres) --
 * un deuxième appel sur un token déjà tranché touche 0 ligne et reçoit 409,
 * jamais une double décision silencieuse.
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const decision = body.decision;
  if (decision !== 'approuve' && decision !== 'refuse') {
    return NextResponse.json({ error: 'invalid_decision' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: updated, error } = await supabase
    .from('guest_approval_requests')
    .update({ statut: decision, decided_at: new Date().toISOString() })
    .eq('token', token)
    .eq('statut', 'en_attente')
    .select('*')
    .maybeSingle<GuestApprovalRequestRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!updated) {
    // Soit le token n'existe pas, soit la demande a déjà été tranchée --
    // distingue les deux pour un message clair côté page publique.
    const { data: existing } = await supabase
      .from('guest_approval_requests')
      .select('statut')
      .eq('token', token)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'already_decided', statut: existing.statut }, { status: 409 });
    }
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  await supabase.from('audit_logs').insert({
    event_id: updated.event_id,
    action: 'guest_approval_decided',
    details: {
      request_id: updated.id,
      nom_invite: updated.nom_invite,
      nombre_invites: updated.nombre_invites,
      cote: updated.cote,
      decision,
    },
  });

  const reserveRemaining = await getReserveRemaining(supabase, updated.event_id);
  try {
    await notifyApproverDecision(updated, decision, reserveRemaining);
  } catch {
    // Le SMS de confirmation est un bonus, pas une condition de succès de la
    // décision elle-même -- déjà actée en base au-dessus.
  }

  return NextResponse.json({ statut: updated.statut });
}
