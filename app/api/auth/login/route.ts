import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSessionToken, verifySecret, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Mode admin : email + mot de passe
  if (body.mode === 'password') {
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, event_id, nom_affichage, role, password_hash, active')
      .eq('email', email)
      .maybeSingle();

    if (!user || !user.active || !user.password_hash || !verifySecret(password, user.password_hash)) {
      return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 });
    }

    return setSessionAndRespond(user);
  }

  // Mode agent/placeur : nom + PIN
  if (body.mode === 'pin') {
    const { nom_affichage, pin } = body;
    if (!nom_affichage || !pin) {
      return NextResponse.json({ error: 'Nom et PIN requis' }, { status: 400 });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, event_id, nom_affichage, role, pin_hash, active')
      .eq('nom_affichage', nom_affichage)
      .maybeSingle();

    if (!user || !user.active || !user.pin_hash || !verifySecret(pin, user.pin_hash)) {
      return NextResponse.json({ error: 'Nom ou PIN incorrect' }, { status: 401 });
    }

    return setSessionAndRespond(user);
  }

  return NextResponse.json({ error: 'Mode de connexion inconnu' }, { status: 400 });
}

function setSessionAndRespond(user: {
  id: string;
  event_id: string;
  nom_affichage: string;
  role: 'admin' | 'agent_checkin' | 'placeur';
}) {
  const token = createSessionToken({
    id: user.id,
    event_id: user.event_id,
    nom_affichage: user.nom_affichage,
    role: user.role,
  });

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, nom_affichage: user.nom_affichage, role: user.role },
  });

  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });

  // Cookie NON httpOnly, lisible en JS, pour que l'UI cliente sache quel role
  // afficher (nav du bas, etc.) sans jamais exposer le jeton de session signe.
  res.cookies.set('wc_role', user.role, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });

  return res;
}
