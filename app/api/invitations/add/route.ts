import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';

/**
 * Cree UNE invitation individuelle (un invite de derniere minute, absent de
 * la liste importee) -- distinct de /api/admin/import (reserve a l'admin,
 * pense pour l'import CSV en masse). Ouvert a admin/directeur (capacite
 * dediee `addInvitation`, ouverte au directeur le 02/09/2026 -- demande
 * explicite de Gersom apres le test de Remy) : sans donner acces aux
 * fonctions plus sensibles reservees a l'admin (import en masse, export,
 * mode test, gestion des comptes).
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
  const tableId = typeof body.table_id === 'string' && body.table_id.trim() ? body.table_id.trim() : null;
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
  const telephone = typeof body.telephone === 'string' && body.telephone.trim() ? body.telephone.trim() : null;
  // Les etiquettes (ex: SERVICES -> visible de tous sur /staff) restent
  // gouvernees par la capacite `manageTags`, pas `addInvitation` : un role
  // qui peut ajouter un invite ne peut pas forcement le reclassifier. Verifie
  // cote serveur meme si l'interface ne montre ce champ qu'aux roles
  // autorises (CLAUDE.md : le controle serveur reste obligatoire).
  const requestedTags = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === 'string' && t.trim()) : [];
  const tags: string[] = hasCapability(user.role, 'manageTags') ? requestedTags : [];

  if (!nomAffichage) {
    return NextResponse.json({ error: 'Le nom est obligatoire' }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (tableId) {
    const { data: table } = await supabase
      .from('tables')
      .select('id')
      .eq('event_id', user.event_id)
      .eq('id', tableId)
      .maybeSingle();
    if (!table) {
      return NextResponse.json({ error: 'Table introuvable' }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from('invitations')
    .insert({
      event_id: user.event_id,
      table_id: tableId,
      nom_affichage: nomAffichage,
      nombre_prevu: nombrePrevu,
      notes,
      telephone,
    })
    .select('id, nom_affichage, table_id, nombre_prevu, telephone, tags')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Etiquettes appliquees une par une via le meme chemin que
  // /api/invitations/tags/add (RPC add_invitation_tag) : reutilise les
  // effets de bord deja testes sur category/cote au lieu de les dupliquer.
  let invitation = data;
  for (const tag of tags) {
    const { data: tagged, error: tagError } = await supabase.rpc('add_invitation_tag', {
      p_invitation_id: invitation.id,
      p_tag: tag,
      p_agent_id: user.id,
    });
    if (!tagError && tagged) invitation = tagged;
  }

  return NextResponse.json({ invitation });
}
