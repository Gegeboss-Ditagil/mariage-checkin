import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { logServerEvent } from '@/lib/serverLog';

// Route PUBLIQUE (voir middleware.ts PUBLIC_PATHS) : une erreur cote client
// peut survenir AVANT toute connexion (/login) ou pendant une session deja
// invalide -- exiger une session ici casserait justement le signalement des
// cas les plus utiles a diagnostiquer. La session est lue en best-effort
// (jamais exigee) pour associer l'evenement/le role quand elle existe.
const MAX_BODY_BYTES = 20 * 1024;

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload trop volumineux' }, { status: 413 });
  }

  const body = (() => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  })();

  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return NextResponse.json({ error: 'message requis' }, { status: 400 });
  }

  const user = getSessionUser();

  await logServerEvent({
    event_id: user?.event_id ?? null,
    source: 'client',
    level: body.level === 'warn' || body.level === 'info' ? body.level : 'error',
    path: typeof body.path === 'string' ? body.path.slice(0, 500) : null,
    message,
    stack: typeof body.stack === 'string' ? body.stack : null,
    digest: typeof body.digest === 'string' ? body.digest : null,
    context: {
      userAgent: req.headers.get('user-agent') || undefined,
      role: user?.role,
      userId: user?.id,
      ...(body.context && typeof body.context === 'object' ? body.context : {}),
    },
  });

  // Toujours 204 quel que soit le resultat interne (best-effort) -- un
  // signalement d'erreur ne doit jamais lui-meme produire une erreur visible
  // ni un retry cote client.
  return new NextResponse(null, { status: 204 });
}
