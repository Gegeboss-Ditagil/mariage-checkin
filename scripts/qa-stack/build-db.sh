#!/usr/bin/env bash
# Reconstruit la base de test locale : socle Supabase, TOUTES les migrations du
# dépôt dans l'ordre (échoue si l'une ne passe pas), puis données synthétiques.
# Usage : PGHOST=/tmp PGPORT=54329 scripts/qa-stack/build-db.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGUSER=${PGUSER:-postgres}
psql -q -d postgres -c "drop database if exists app with (force)" -c "create database app"
PSQL="psql -q -d app -v ON_ERROR_STOP=1"
$PSQL -f scripts/qa-stack/00_supabase_shim.sql 2>/dev/null
EVENT=00000000-0000-4000-8000-000000000001
for f in $(ls supabase/migrations/*.sql | sort); do
  if ! out=$($PSQL -f "$f" 2>&1); then
    echo "ÉCHEC de la migration $(basename "$f") :"; echo "$out" | grep -m3 ERROR; exit 1
  fi
  if [[ "$(basename "$f")" == 0001_* ]]; then
    # L'événement et les 42 tables existent en production avant toute
    # migration de données : on les crée juste après le schéma initial.
    $PSQL -c "insert into events (id, name, status) values ('$EVENT', 'Mariage QA', 'test');
      insert into tables (event_id, number, capacity, is_reserve) select '$EVENT', n, 10, n in (1, 42) from generate_series(1, 42) n;"
  fi
done
$PSQL -c "update tables set capacity = 10, is_reserve = number in (1, 42) where event_id = '$EVENT';"
node --experimental-strip-types --no-warnings scripts/qa-stack/seed.ts | $PSQL
# PostgREST garde le schéma en cache : on lui demande de le relire (sans effet s'il ne tourne pas encore).
$PSQL -c "notify pgrst, 'reload schema';"
echo "Base de test prête : $(psql -At -d app -c 'select count(*) from invitations') invitations, $(psql -At -d app -c 'select count(*) from users') comptes."
