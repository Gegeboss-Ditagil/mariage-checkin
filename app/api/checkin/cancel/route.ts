import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  // v1.72.1 : capacité centralisée (lib/permissions.ts) au lieu d'une liste
  // de rôles recopiée ici -- mêmes rôles autorisés qu'avant.
  if (!user || !hasCapability(user.role, 'checkin')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { invitation_id } = await req.json().catch(() => ({}));
  if (!invitation_id) {
    return NextResponse.json({ error: 'invitation_id requis' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('cancel_last_checkin', {
    p_invitation_id: invitation_id,
    p_agent_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ invitation: data });
}

