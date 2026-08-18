import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hashSecret } from '@/lib/auth';

export async function GET() {
  const user = getSessionUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, nom_affichage, role, email, active, created_at')
    .eq('event_id', user.event_id)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ users: data });
}

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { nom_affichage, role, email, password, pin } = await req.json().catch(() => ({}));
  if (!nom_affichage || !role) {
    return NextResponse.json({ error: 'nom_affichage et role requis' }, { status: 400 });
  }
  if (role === 'admin' && (!email || !password)) {
    return NextResponse.json({ error: 'email et mot de passe requis pour un admin' }, { status: 400 });
  }
  if (role !== 'admin' && !pin) {
    return NextResponse.json({ error: 'PIN requis pour un agent/placeur' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('users')
    .insert({
      event_id: user.event_id,
      nom_affichage,
      role,
      email: email || null,
      password_hash: password ? hashSecret(password) : null,
      pin_hash: pin ? hashSecret(pin) : null,
    })
    .select('id, nom_affichage, role, email, active')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ user: data });
}

export async function PATCH(req: NextRequest) {
  const user = getSessionUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id, active } = await req.json().catch(() => ({}));
  if (!id || typeof active !== 'boolean') {
    return NextResponse.json({ error: 'id et active requis' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('users').update({ active }).eq('id', id).eq('event_id', user.event_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
