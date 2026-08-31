import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';
import { applyGuestApprovalDecision } from '@/lib/guestApprovalDecide';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'reviewGuestApproval')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  if (body.decision !== 'approuve' && body.decision !== 'refuse') {
    return NextResponse.json({ error: 'invalid_decision' }, { status: 400 });
  }
  const result = await applyGuestApprovalDecision(createAdminClient(), { id: params.id }, body.decision, 'app');
  if (!result.ok) {
    return NextResponse.json(result, { status: result.reason === 'not_found' ? 404 : 409 });
  }
  return NextResponse.json(result);
}
