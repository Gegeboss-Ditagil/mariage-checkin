import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'manageMembers')) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { invitation_id } = await req.json().catch(() => ({}));
  if (!invitation_id) return NextResponse.json({ error: 'Invitation requise' }, { status: 400 });
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('ensure_invitation_member_rows', { p_invitation_id: invitation_id, p_agent_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: error.message === 'invitation_not_found' ? 404 : 400 });
  return NextResponse.json({ invitation: data });
}
