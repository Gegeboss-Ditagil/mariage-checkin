import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !['admin', 'agent_checkin', 'placeur'].includes(user.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { assignment_id } = await req.json().catch(() => ({}));
  if (!assignment_id) {
    return NextResponse.json({ error: 'assignment_id requis' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc('unassign_overflow', {
    p_assignment_id: assignment_id,
    p_agent_id: user.id,
  });

  if (error) {
    const status = error.message === 'assignment_not_found' ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ ok: true });
}
