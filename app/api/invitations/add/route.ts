import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';

/**
 * Cree UNE invitation individuelle (un invite de derniere minute, absent de
 * la liste importee) -- distinct de /api/admin/import (reserve a l'admin,
 * pense pour l'import CSV en masse). Ouvert a admin/directeur/placeur : ce
 * sont les roles qui peuvent deja modifier/deplacer les tables, donc gerer
 * l'arrivee d'un invite imprevu le jour J s'inscrit dans les memes
 * responsabilites operationnelles -- sans donner acces aux fonctions plus
 * sensibles reservees a l'admin (import en masse, export, mode test,
 * gestion des comptes).
 */
export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'addInvitation')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const nomAffichage = typeof body.nom_affichage === 'string' ? body.nom_affichage.trim() : '';
  const nombrePrevuRaw = Number(body.nombre_prevu);
  const nombrePrevu = Number.isFinite(nombrePrevuRaw) && nombrePrevuRaw > 0 ? Math.floor(nombrePrevuRaw) : 1;
  const tableNumberRaw = body.table_number;
  const tableNumber =
    tableNumberRaw !== undefined && tableNumberRaw !== null && tableNumberRaw !== ''
      ? Number(tableNumberRaw)
      : null;
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;

  if (!nomAffichage) {
    return NextResponse.json({ error: 'Le nom est obligatoire' }, { status: 400 });
  }

  const supabase = createAdminClient();

  let tableId: string | null = null;
  if (tableNumber !== null) {
    const { data: table } = await supabase
      .from('tables')
      .select('id')
      .eq('event_id', user.event_id)
      .eq('number', tableNumber)
      .maybeSingle();
    if (!table) {
      return NextResponse.json({ error: 'Table n°' + tableNumber + ' introuvable' }, { status: 400 });
    }
    tableId = table.id;
  }

  const { data, error } = await supabase
    .from('invitations')
    .insert({
      event_id: user.event_id,
      table_id: tableId,
      nom_affichage: nomAffichage,
      nombre_prevu: nombrePrevu,
      notes,
    })
    .select('id, nom_affichage, table_id, nombre_prevu')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ invitation: data });
}
