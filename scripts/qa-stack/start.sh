#!/usr/bin/env bash
# Démarre la pile de test fonctionnel complète, en local, sans toucher à la
# production : PostgREST + passerelle Supabase + application Next.js (build de
# production). Prérequis : base construite (build-db.sh), binaire PostgREST
# (QA_POSTGREST_BIN). Les variables d'environnement à exporter pour Playwright
# sont écrites dans scripts/qa-stack/.env.qa (ignoré par git).
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${QA_POSTGREST_BIN:?chemin du binaire postgrest (QA_POSTGREST_BIN)}"
PGHOST=${PGHOST:-/tmp}; PGPORT=${PGPORT:-54329}
APP_PORT=${QA_APP_PORT:-3100}
SECRET=$(node -e "import('./scripts/qa-stack/jwt.mjs').then(m=>console.log(m.QA_JWT_SECRET))")
ANON=$(node scripts/qa-stack/jwt.mjs anon)
SERVICE=$(node scripts/qa-stack/jwt.mjs service_role)
mkdir -p .qa
PGRST_DB_URI="postgres://authenticator@/app?host=$PGHOST&port=$PGPORT" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
  PGRST_JWT_SECRET="$SECRET" PGRST_SERVER_PORT=54330 PGRST_DB_POOL=20 "$QA_POSTGREST_BIN" > .qa/postgrest.log 2>&1 &
node scripts/qa-stack/gateway.mjs > .qa/gateway.log 2>&1 &
cat > scripts/qa-stack/.env.qa <<ENV
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
SESSION_SECRET=qa-session-secret-qa-session-secret-0001
QA_BASE_URL=http://localhost:$APP_PORT
ENV
set -a; . scripts/qa-stack/.env.qa; set +a
if [ "${QA_SKIP_BUILD:-0}" != "1" ]; then npx next build > .qa/build.log 2>&1; fi
npx next start -p "$APP_PORT" > .qa/app.log 2>&1 &
for i in $(seq 1 60); do curl -s -o /dev/null "http://localhost:$APP_PORT/login" && break; sleep 1; done
echo "Pile de test prête : http://localhost:$APP_PORT"
