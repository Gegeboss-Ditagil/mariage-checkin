import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !['admin', 'agent_checkin'].includes(user.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { type, description, invitation_id, table_id } = await req.json().catch(() => ({}));
  if (!type) return NextResponse.json({ error: 'type requis' }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('exceptions')
    .insert({
      event_id: user.event_id,
      type,
      description: description || null,
      invitation_id: invitation_id || null,
      table_id: table_id || null,
      reported_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ exception: data });
}
