import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashSecret, verifySecret } from '@/lib/auth';
import { maskPinForHint } from '@/lib/passwordReset';
import { logServerEvent } from '@/lib/serverLog';

// v1.69.0, demande de Gersom le 07/10/2026 : "j'aimerais que les gens aient
// la possibilité de modifier leur mot de passe eux-mêmes" -- distinct de
// /api/passwords (reinitialiser le compte d'AUTRUI, reserve a la capacite
// dediee a ca dans lib/permissions.ts) : ici, N'IMPORTE QUEL role change
// SON PROPRE secret, sans verification de capacite, mais seulement en
// reprouvant le secret ACTUEL (comme tout changement de mot de passe
// classique) -- aucune reinitialisation "a l'aveugle" possible ici.
export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { currentSecret, newSecret } = await req.json().catch(() => ({}));
  if (!currentSecret || !newSecret) {
    return NextResponse.json({ error: 'Champs requis' }, { status: 400 });
  }

  const column = user.role === 'admin' ? 'password_hash' : 'pin_hash';
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from('users')
    .select('id, password_hash, pin_hash')
    .eq('id', user.id)
    .eq('event_id', user.event_id)
    .maybeSingle();
  if (error || !row) return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 });

  const storedHash = column === 'password_hash' ? row.password_hash : row.pin_hash;
  if (!storedHash || !verifySecret(currentSecret, storedHash)) {
    return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 401 });
  }

  if (user.role === 'admin') {
    if (typeof newSecret !== 'string' || newSecret.length < 6) {
      return NextResponse.json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' }, { status: 400 });
    }
  } else if (!/^\d{4}$/.test(newSecret)) {
    return NextResponse.json({ error: 'Le nouveau PIN doit contenir exactement 4 chiffres' }, { status: 400 });
  }

  const updates = user.role === 'admin'
    ? { password_hash: hashSecret(newSecret) }
    : { pin_hash: hashSecret(newSecret), pin_reset_hint: maskPinForHint(newSecret) };

  const { error: updateError } = await supabase
    .from('users')
    .update(updates)
    .eq('id', user.id)
    .eq('event_id', user.event_id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  // Jamais le secret en clair dans les logs -- seulement qui a change son
  // propre mot de passe, meme esprit que le 'password_reset' de
  // /api/passwords (reinitialisation par un tiers).
  void logServerEvent({
    event_id: user.event_id,
    level: 'info',
    message: 'self_password_change',
    context: { actorId: user.id, actorRole: user.role },
  });

  return NextResponse.json({ ok: true });
}
