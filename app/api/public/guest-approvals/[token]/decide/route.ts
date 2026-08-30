import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyGuestApprovalDecision } from '@/lib/guestApprovalDecide';

/**
 * Route PUBLIQUE -- décision (Approuver/Refuser) depuis /approve/[token].
 * Un seul clic possible : logique atomique partagée avec le webhook WhatsApp
 * entrant (lib/guestApprovalDecide.ts) -- un deuxième appel sur un token déjà
 * tranché reçoit 409, jamais une double décision silencieuse.
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
  const result = await applyGuestApprovalDecision(supabase, { token }, decision, 'web');

  if (!result.ok) {
    return result.reason === 'already_decided'
      ? NextResponse.json({ error: 'already_decided', statut: result.statut }, { status: 409 })
      : NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ statut: result.request.statut });
}
