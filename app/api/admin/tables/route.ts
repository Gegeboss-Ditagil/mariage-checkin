import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

export async function GET() {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tables')
    .select('*')
    .eq('event_id', user.event_id)
    .order('number');

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tables: data || [] });
}

/**
 * Genere en une fois les tables 1..normalCount (normales) puis
 * normalCount+1..normalCount+reserveCount (reserve), avec la capacite donnee.
 * Ignore les numeros deja existants pour rester idempotent.
 */
export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const normalCount = Number(body.normalCount ?? 36);
  const reserveCount = Number(body.reserveCount ?? 4);
  const normalCapacity = Number(body.normalCapacity ?? 10);
  const reserveCapacity = Number(body.reserveCapacity ?? 10);

  if (![normalCount, reserveCount, normalCapacity, reserveCapacity].every((n) => Number.isFinite(n) && n >= 0)) {
    return NextResponse.json({ error: 'paramètres invalides' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase.from('tables').select('number').eq('event_id', user.event_id);
  const existingNumbers = new Set((existing || []).map((t) => t.number));

  const rows: { event_id: string; number: number; capacity: number; is_reserve: boolean }[] = [];
  for (let n = 1; n <= normalCount; n++) {
    if (!existingNumbers.has(n)) rows.push({ event_id: user.event_id, number: n, capacity: normalCapacity, is_reserve: false });
  }
  for (let n = normalCount + 1; n <= normalCount + reserveCount; n++) {
    if (!existingNumbers.has(n)) rows.push({ event_id: user.event_id, number: n, capacity: reserveCapacity, is_reserve: true });
  }

  if (rows.length === 0) {
    return NextResponse.json({ inserted: 0 });
  }

  const { error } = await supabase.from('tables').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ inserted: rows.length });
}

export async function PATCH(req: NextRequest) {
  const user = getSessionUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id, capacity, label, zone, is_reserve } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (capacity !== undefined) patch.capacity = Number(capacity);
  if (label !== undefined) patch.label = label || null;
  if (zone !== undefined) patch.zone = zone || null;
  if (is_reserve !== undefined) patch.is_reserve = Boolean(is_reserve);

  const supabase = createAdminClient();
  const { error } = await supabase.from('tables').update(patch).eq('id', id).eq('event_id', user.event_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = getSessionUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from('tables').delete().eq('id', id).eq('event_id', user.event_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
