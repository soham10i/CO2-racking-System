#!/usr/bin/env bash
# Restore a dump into the running stack. DESTRUCTIVE: replaces the current database contents.
#   ./restore.sh /var/backups/co2tracker/co2tracker-20261030T031500Z.dump
# To fetch one from Object Storage first, use the Console's Download, or the same aws-cli container as backup.sh with `s3 cp s3://… /backups/`.
set -euo pipefail
cd "$(dirname "$0")"
dump="${1:?usage: restore.sh <file.dump>}"
read -r -p "This replaces all data in co2tracker with $dump. Type 'restore' to continue: " ok
[ "$ok" = "restore" ] || exit 1

docker compose stop api
docker compose exec -T postgres pg_restore -U co2tracker -d co2tracker --clean --if-exists --no-owner < "$dump"
docker compose start api
echo "Restored. Check: docker compose logs -f api"
