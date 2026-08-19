import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !['admin', 'agent_checkin', 'placeur'].includes(user.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { guest_id } = await req.json().catch(() => ({}));
  if (!guest_id) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('remove_invitation_member', {
    p_guest_id: guest_id,
    p_agent_id: user.id,
  });

  if (error) {
    const status = error.message === 'member_not_found' || error.message === 'invitation_not_found' ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ invitation: data });
}

