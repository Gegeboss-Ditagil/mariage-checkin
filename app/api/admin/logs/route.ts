import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

const PAGE_SIZE = 100;

// Lecture seule -- admin uniquement (voir app/admin/logs/page.tsx). Filtre
// optionnel par source ('client'/'server') et niveau ('error'/'warn'/'info'),
// toujours borne a l'evenement de l'agent connecte (jamais tous les
// evenements si ce projet en accueillait plusieurs un jour).
export async function GET(req: NextRequest) {
  const user = getSessionUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source');
  const level = searchParams.get('level');

  const supabase = createAdminClient();
  let query = supabase
    .from('app_logs')
    .select('id, source, level, path, message, stack, digest, context, created_at')
    .eq('event_id', user.event_id)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (source === 'client' || source === 'server') query = query.eq('source', source);
  if (level === 'error' || level === 'warn' || level === 'info') query = query.eq('level', level);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ logs: data || [] }, { headers: { 'Cache-Control': 'private, no-store' } });
}
