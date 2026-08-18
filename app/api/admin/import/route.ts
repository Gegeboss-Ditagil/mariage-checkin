import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

interface ImportRow {
  nom_affichage: string;
  groupe?: string;
  table_number?: number;
  nombre_prevu?: number;
  notes?: string;
  vip?: boolean;
  category?: string;
  telephone?: string;
  email?: string;
}

/**
 * Recoit des lignes deja parsees cote client (papaparse/xlsx) + le mapping de
 * colonnes deja applique (voir /admin/import UI). Cree les invitations, et
 * les rattache a une table existante par numero si fournie.
 */
export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { rows } = (await req.json().catch(() => ({ rows: [] }))) as { rows: ImportRow[] };
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Aucune ligne à importer' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: tables } = await supabase.from('tables').select('id, number').eq('event_id', user.event_id);
  const tableByNumber = new Map((tables || []).map((t) => [t.number, t.id]));

  const toInsert = rows.map((r) => ({
    event_id: user.event_id,
    table_id: r.table_number != null ? tableByNumber.get(r.table_number) ?? null : null,
    nom_affichage: r.nom_affichage,
    groupe: r.groupe || null,
    nombre_prevu: r.nombre_prevu && r.nombre_prevu > 0 ? r.nombre_prevu : 1,
    notes: r.notes || null,
    category: r.category || null,
    telephone: r.telephone || null,
    email: r.email || null,
  }));

  const { data, error } = await supabase.from('invitations').insert(toInsert).select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const unmatchedTables = rows.filter((r) => r.table_number != null && !tableByNumber.has(r.table_number)).length;

  return NextResponse.json({ imported: data?.length ?? 0, unmatchedTables });
}
