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

  const { nom_affichage, role, pin, email, password } = await req.json().catch(() => ({}));
  if (!nom_affichage || !role) {
    return NextResponse.json({ error: 'nom_affichage et role requis' }, { status: 400 });
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

const ROLES = ['admin', 'directeur', 'placeur', 'agent_checkin', 'visibilite'];

export async function PATCH(req: NextRequest) {
  const user = getSessionUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id, active, nom_affichage, email, pin, password, role } = await req.json().catch(() => ({}));
  if (!id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }
  if (role !== undefined && !ROLES.includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
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
  } else if (typeof role === 'string') {
    if (!pin) {
      return NextResponse.json({ error: 'PIN requis pour passer ce compte hors admin' }, { status: 400 });
    }
    updates.role = role;
    updates.pin_hash = hashSecret(pin);
    updates.email = null;
    updates.password_hash = null;
  } else {
    // Rôle inchangé : mise à jour normale des identifiants existants.
    if (typeof email === 'string') updates.email = email.trim() || null;
    if (typeof pin === 'string' && pin.trim()) updates.pin_hash = hashSecret(pin.trim());
    if (typeof password === 'string' && password.trim()) updates.password_hash = hashSecret(password.trim());
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });
  }

  const supabase = createAdminClient();
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
  return NextResponse.json({ user: data });
}
