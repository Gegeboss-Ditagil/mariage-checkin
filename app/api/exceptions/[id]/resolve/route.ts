import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  // v1.72.1 : capacité centralisée (lib/permissions.ts) au lieu d'une liste
  // de rôles recopiée ici -- mêmes rôles autorisés qu'avant.
  if (!user || !hasCapability(user.role, 'resolveExceptions')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { resolution_notes } = await req.json().catch(() => ({}));

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('exceptions')
    .update({
      resolved: true,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_notes: resolution_notes || null,
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ exception: data });
}

