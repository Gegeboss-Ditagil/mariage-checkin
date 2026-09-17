import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { createSessionToken, verifySessionToken } from '../lib/auth.ts';
import { verifySessionTokenEdge } from '../lib/session-edge.ts';
import { SESSION_SCHEMA_VERSION } from '../lib/sessionVersion.ts';

// v1.53.19, retour de Gersom (17/09/2026) : "j'ai un probleme de deconnexion
// enorme sur l'application... surtout quand on navigue de page rapidement,
// apres 5-6 pages, ca se deconnecte souvent". Root cause : le jeton de
// session portait `ver = VERCEL_DEPLOYMENT_ID` (ou son fallback git sha) --
// CHAQUE deploiement Vercel, y compris un correctif sans aucun rapport avec
// les sessions, invalidait instantanement toutes les sessions actives. Ce
// projet deploie tres frequemment (plusieurs fois par jour) : le symptome
// exact signale correspond a la fenetre de vulnerabilite multipliee par le
// prefetch automatique de Next.js (BottomNav affiche 4-5 <Link>, chacun
// precharge en arriere-plan des qu'une page se monte -- 4-5x plus de
// verifications de session que de vraies navigations).
//
// Deux correctifs : (1) lib/sessionVersion.ts decouple la validite d'une
// session de tout deploiement -- seule l'expiration naturelle (12h) ou un
// changement reel du FORMAT du payload la termine desormais ; (2)
// middleware.ts ne nettoie plus les cookies sur une requete de simple
// prefetch (jamais vue par l'utilisateur), pour qu'un echec de verification
// en arriere-plan ne puisse jamais deconnecter une session par ailleurs
// valide affichee sur un autre onglet/une autre page.
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-session-stability';

function resign(encoded: string): string {
  return createHmac('sha256', process.env.SESSION_SECRET as string).update(encoded).digest('hex');
}

const baseUser = {
  id: 'user-1',
  event_id: 'event-1',
  nom_affichage: 'Test User',
  nom_complet: 'Test User Complet',
  role: 'placeur' as const,
};

test('un jeton cree puis verifie immediatement reste valide (aller-retour Node)', () => {
  const token = createSessionToken(baseUser);
  const verified = verifySessionToken(token);
  assert.ok(verified);
  assert.equal(verified?.id, baseUser.id);
  assert.equal(verified?.role, baseUser.role);
});

test('un jeton cree cote Node (lib/auth.ts) reste verifiable cote Edge (lib/session-edge.ts) -- interoperabilite HMAC', async () => {
  const token = createSessionToken(baseUser);
  const verified = await verifySessionTokenEdge(token);
  assert.ok(verified);
  assert.equal(verified?.id, baseUser.id);
});

test('un deploiement (changement de VERCEL_DEPLOYMENT_ID/VERCEL_GIT_COMMIT_SHA entre la creation et la verification) n\'invalide plus une session -- regression du bug de deconnexions frequentes', async () => {
  const originalDeploymentId = process.env.VERCEL_DEPLOYMENT_ID;
  const originalGitSha = process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    process.env.VERCEL_DEPLOYMENT_ID = 'dpl_avant_le_deploiement';
    const token = createSessionToken(baseUser);

    // Simule un nouveau deploiement Vercel pendant que la session est active.
    process.env.VERCEL_DEPLOYMENT_ID = 'dpl_apres_le_deploiement';
    process.env.VERCEL_GIT_COMMIT_SHA = 'nouveau-sha-de-commit';

    assert.ok(verifySessionToken(token), 'verifySessionToken (Node) doit rester valide apres un "deploiement"');
    assert.ok(await verifySessionTokenEdge(token), 'verifySessionTokenEdge doit rester valide apres un "deploiement"');
  } finally {
    if (originalDeploymentId === undefined) delete process.env.VERCEL_DEPLOYMENT_ID;
    else process.env.VERCEL_DEPLOYMENT_ID = originalDeploymentId;
    if (originalGitSha === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = originalGitSha;
  }
});

test('un jeton dont le `ver` ne correspond plus a SESSION_SCHEMA_VERSION est rejete, meme correctement signe -- un vrai changement de format de payload doit encore forcer une reconnexion propre', async () => {
  const token = createSessionToken(baseUser);
  const [encoded] = token.split('.');
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  assert.equal(payload.ver, SESSION_SCHEMA_VERSION);

  // Forge un jeton avec un `ver` different mais VALIDEMENT RE-SIGNE (le
  // secret est connu du test) -- isole precisement la verification de `ver`
  // de celle de la signature.
  const oldVerEncoded = Buffer.from(JSON.stringify({ ...payload, ver: 'ancien-format-avant-migration' })).toString('base64url');
  const oldVerToken = oldVerEncoded + '.' + resign(oldVerEncoded);

  assert.equal(verifySessionToken(oldVerToken), null);
  assert.equal(await verifySessionTokenEdge(oldVerToken), null);
});

test('un jeton expire (exp dans le passe) reste rejete -- l\'expiration naturelle de 12h n\'est pas affectee par ce correctif', async () => {
  const token = createSessionToken(baseUser);
  const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
  const expiredEncoded = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() - 1000 })).toString('base64url');
  const expiredToken = expiredEncoded + '.' + resign(expiredEncoded);

  assert.equal(verifySessionToken(expiredToken), null);
  assert.equal(await verifySessionTokenEdge(expiredToken), null);
});

test('lib/auth.ts et lib/session-edge.ts ne referencent plus VERCEL_DEPLOYMENT_ID/VERCEL_GIT_COMMIT_SHA -- verrou anti-regression', () => {
  const authSource = readFileSync(new URL('../lib/auth.ts', import.meta.url), 'utf8');
  const edgeSource = readFileSync(new URL('../lib/session-edge.ts', import.meta.url), 'utf8');
  for (const source of [authSource, edgeSource]) {
    assert.doesNotMatch(source, /VERCEL_DEPLOYMENT_ID/);
    assert.doesNotMatch(source, /VERCEL_GIT_COMMIT_SHA/);
    assert.match(source, /SESSION_SCHEMA_VERSION/);
  }
});

test('middleware.ts ne nettoie jamais les cookies de session pour une simple requete de prefetch', () => {
  const source = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');
  assert.match(source, /next-router-prefetch/);
  assert.match(source, /function isPrefetch/);
  assert.match(source, /if \(isPrefetch\(req\)\) return NextResponse\.next\(\);/);
  // Le nettoyage de cookies (redirectToLogin) doit se produire APRES le
  // court-circuit prefetch, jamais avant.
  const prefetchGuardIndex = source.indexOf('if (isPrefetch(req)) return NextResponse.next();');
  const redirectCallIndex = source.indexOf('return redirectToLogin(req, pathname);');
  assert.ok(prefetchGuardIndex > -1 && redirectCallIndex > -1);
  assert.ok(prefetchGuardIndex < redirectCallIndex);
});
