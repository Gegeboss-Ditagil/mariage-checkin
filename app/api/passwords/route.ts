import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { canResetPassword, canViewPasswordHint, hasCapability } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashSecret } from '@/lib/auth';
import { generateRandomPin, maskPinForHint } from '@/lib/passwordReset';
import { logServerEvent } from '@/lib/serverLog';

// v1.65.0, retour de Gersom (message vocal, 03/10/2026) : systeme de
// gestion des mots de passe/PIN separe de /admin/users (qui reste reserve a
// `role === 'admin'` pour la creation de compte et le changement de role,
// hors perimetre de cette demande) -- voir lib/permissions.ts
// (canResetPassword/canViewPasswordHint) pour la seule source de verite sur
// qui peut reinitialiser/voir quoi.

export async function GET() {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'managePasswords')) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, nom_affichage, nom_complet, role, active, pin_reset_hint')
    .eq('event_id', user.event_id)
    .order('nom_affichage');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const canViewHints = canViewPasswordHint(user);
  const users = (data || []).map((row) => ({
    id: row.id,
    nom_affichage: row.nom_affichage,
    nom_complet: row.nom_complet,
    role: row.role,
    active: row.active,
    canReset: canResetPassword(user, row.role),
    // L'indice ne part JAMAIS vers un compte sans canViewPasswordHint --
    // filtrage reel cote serveur, jamais un masquage visuel cote client.
    hint: canViewHints ? row.pin_reset_hint : undefined,
  }));

  return NextResponse.json(
    { users, canViewHints },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'managePasswords')) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'Compte requis' }, { status: 400 });

  const supabase = createAdminClient();
  const { data: target, error: targetError } = await supabase
    .from('users')
    .select('id, nom_affichage, role')
    .eq('id', id)
    .eq('event_id', user.event_id)
    .maybeSingle();
  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 400 });
  if (!target) return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 });

  if (!canResetPassword(user, target.role)) {
    return NextResponse.json({ error: 'Vous ne pouvez pas réinitialiser ce compte' }, { status: 403 });
  }

  const pin = generateRandomPin();
  const { error: updateError } = await supabase
    .from('users')
    .update({ pin_hash: hashSecret(pin), pin_reset_hint: maskPinForHint(pin) })
    .eq('id', id)
    .eq('event_id', user.event_id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  // Jamais le PIN en clair dans les logs -- seulement qui a reinitialise le
  // compte de qui, pour une traçabilite minimale (meme esprit que
  // audit_logs pour les autres actions sensibles).
  void logServerEvent({
    event_id: user.event_id,
    level: 'info',
    message: 'password_reset',
    context: { actorId: user.id, actorRole: user.role, targetId: target.id, targetRole: target.role },
  });

  return NextResponse.json({ pin, nom_affichage: target.nom_affichage });
}
