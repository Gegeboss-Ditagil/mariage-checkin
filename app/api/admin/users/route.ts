import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { forgetAccountState, getSessionUser } from '@/lib/session';
import { hashSecret } from '@/lib/auth';
import type { Role } from '@/lib/types';
import { logServerEvent } from '@/lib/serverLog';
import { canDeleteAccount, canManageAccount, canResetPassword, canViewPasswordHint, hasCapability } from '@/lib/permissions';

const ROLES = ['admin', 'directeur', 'placeur', 'agent_checkin', 'visibilite'];

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasCapability(user.role, 'manageAccounts')) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, nom_affichage, role, email, active, created_at, pin_reset_hint, is_super_admin')
    .eq('event_id', user.event_id)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // v1.67.4, retour de Gersom : "réinitialiser"/"modifier" doivent être le
  // même choix, au même endroit (/admin/users), plutôt que réinitialiser
  // vivant sur un écran séparé (supprimé en v1.82.0) -- mêmes fonctions
  // canResetPassword/canViewPasswordHint (lib/permissions.ts, seule source
  // de vérité) que cet autre écran, jamais recréées ici.
  const canViewHints = canViewPasswordHint(user);
  const users = (data || []).map((row) => ({
    id: row.id,
    nom_affichage: row.nom_affichage,
    role: row.role,
    email: row.email,
    active: row.active,
    created_at: row.created_at,
    canReset: canResetPassword(user, row.role),
    hint: canViewHints ? row.pin_reset_hint : undefined,
    isSelf: row.id === user.id,
    canDelete: canDeleteAccount(user, { id: row.id, role: row.role, is_super_admin: row.is_super_admin === true }),
    // v1.81.0 : un directeur voit les comptes admin mais ne peut pas les modifier.
    locked: !canManageAccount(user, row.role),
  }));
  return NextResponse.json({ users, canViewHints, viewerRole: user.role });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasCapability(user.role, 'manageAccounts')) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { nom_affichage, role, pin, email, password } = await req.json().catch(() => ({}));
  if (!nom_affichage || !role) {
    return NextResponse.json({ error: 'nom_affichage et role requis' }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
  }
  if (!canManageAccount(user, role)) {
    return NextResponse.json({ error: 'Seul un admin peut créer un compte admin' }, { status: 403 });
  }

  const insert: Record<string, unknown> = {
    event_id: user.event_id,
    nom_affichage,
    role,
  };

  // Les comptes admin se connectent avec email + mot de passe ; les
  // agents/placeurs se connectent avec nom affiché + PIN (voir /api/auth/login).
  if (role === 'admin') {
    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis pour un compte admin' }, { status: 400 });
    }
    insert.email = email;
    insert.password_hash = hashSecret(password);
  } else {
    if (!pin) {
      return NextResponse.json({ error: 'PIN requis' }, { status: 400 });
    }
    insert.pin_hash = hashSecret(pin);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('users')
    .insert(insert)
    .select('id, nom_affichage, role, email, active')
    .single();

  if (error) {
    const message = error.code === '23505' ? 'Ce nom est déjà utilisé par un autre compte' : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ user: data });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasCapability(user.role, 'manageAccounts')) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id, active, nom_affichage, email, pin, password, role } = await req.json().catch(() => ({}));
  if (!id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }
  if (role !== undefined && !ROLES.includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
  }
  // v1.76.0, trouvé par le balayage « clique partout » : un admin pouvait
  // désactiver ou rétrograder SON PROPRE compte d'un seul geste et ne plus
  // pouvoir se reconnecter (ni personne pour le réactiver s'il est le seul).
  if (id === user.id && (active === false || (role !== undefined && role !== user.role))) {
    return NextResponse.json({ error: 'Vous ne pouvez pas désactiver ni rétrograder votre propre compte' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: target } = await supabase
    .from('users')
    .select('role')
    .eq('id', id)
    .eq('event_id', user.event_id)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 });
  // v1.81.0 : un directeur ne modifie jamais un compte admin, ni n'en crée
  // un en changeant le rôle d'un autre compte (canManageAccount).
  if (!canManageAccount(user, target.role) || (typeof role === 'string' && !canManageAccount(user, role as Role))) {
    return NextResponse.json({ error: 'Seul un admin peut modifier un compte admin' }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof active === 'boolean') updates.active = active;
  if (typeof nom_affichage === 'string' && nom_affichage.trim()) updates.nom_affichage = nom_affichage.trim();

  // Changer de rôle exige les nouveaux identifiants dans la même requête --
  // le mode de connexion dépend du rôle (email + mot de passe pour admin,
  // nom + PIN sinon, voir /api/auth/login) : jamais de bascule qui laisse
  // un compte sans moyen de se reconnecter. Le champ correspondant à
  // l'ancien mode est effacé pour qu'un seul mode reste actif à la fois
  // (demande de Gersom le 02/09/2026 : pouvoir "changer de rôle / accès").
  if (role === 'admin') {
    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis pour passer ce compte en admin' }, { status: 400 });
    }
    updates.role = role;
    updates.email = email.trim();
    updates.password_hash = hashSecret(password);
    updates.pin_hash = null;
  } else if (typeof role === 'string' && target.role === 'admin') {
    if (!pin) {
      return NextResponse.json({ error: 'PIN requis pour passer ce compte hors admin' }, { status: 400 });
    }
    updates.role = role;
    updates.pin_hash = hashSecret(pin);
    updates.email = null;
    updates.password_hash = null;
  } else if (typeof role === 'string') {
    // v1.78.0 : entre deux rôles qui se connectent par nom + PIN, le PIN
    // actuel reste valable -- ne plus le faire ressaisir (« changer le rôle
    // d'un user » doit être un seul geste). Nouveau PIN facultatif.
    updates.role = role;
    if (typeof pin === 'string' && pin.trim()) updates.pin_hash = hashSecret(pin.trim());
  } else {
    // Rôle inchangé : mise à jour normale des identifiants existants.
    if (typeof email === 'string') updates.email = email.trim() || null;
    if (typeof pin === 'string' && pin.trim()) updates.pin_hash = hashSecret(pin.trim());
    if (typeof password === 'string' && password.trim()) updates.password_hash = hashSecret(password.trim());
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .eq('event_id', user.event_id)
    .select('id, nom_affichage, role, email, active')
    .maybeSingle();

  if (error) {
    const message = error.code === '23505' ? 'Ce nom est déjà utilisé par un autre compte' : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  // Effet immédiat : la prochaine requête de ce compte relit son rôle.
  forgetAccountState(id);
  return NextResponse.json({ user: data });
}

// v1.86.0 : suppression définitive d'un compte (admin seulement, voir
// canDeleteAccount). Les journaux (checkins, audit_logs, exceptions...) gardent
// leurs lignes, seule la référence au compte est vidée (ON DELETE SET NULL).
// Un compte qui a soumis ou assigné des demandes d'invités surprise ne peut
// pas être supprimé (clé étrangère sans suppression en cascade) : on propose de
// le désactiver plutôt que de perdre ces demandes.
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasCapability(user.role, 'deleteAccounts')) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'id requis' }, { status: 400 });
  if (id === user.id) return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, { status: 400 });

  const supabase = createAdminClient();
  const { data: target } = await supabase
    .from('users')
    .select('id, nom_affichage, role, is_super_admin')
    .eq('id', id)
    .eq('event_id', user.event_id)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 });
  if (!canDeleteAccount(user, { id: target.id, role: target.role, is_super_admin: target.is_super_admin === true })) {
    return NextResponse.json({ error: 'Ce compte ne peut pas être supprimé par votre compte' }, { status: 403 });
  }

  const { error } = await supabase.from('users').delete().eq('id', id).eq('event_id', user.event_id);
  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Ce compte a des demandes d’invités surprise : désactivez-le plutôt que de le supprimer.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  forgetAccountState(id);
  await logServerEvent({
    event_id: user.event_id,
    level: 'info',
    path: '/api/admin/users',
    message: 'Compte supprimé',
    context: { deleted_id: target.id, deleted_name: target.nom_affichage, deleted_role: target.role, by: user.id },
  });
  return NextResponse.json({ ok: true });
}
