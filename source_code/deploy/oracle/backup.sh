#!/usr/bin/env bash
# Nightly logical backup: pg_dump (custom format) -> local file -> OCI Object Storage (S3-compatible API).
# Cron (as the ubuntu user):  15 3 * * * /home/ubuntu/co2tracker/source_code/deploy/oracle/backup.sh >> /var/backups/co2tracker/backup.log 2>&1
# Retention in the bucket is a lifecycle rule set in the Console (e.g. delete objects older than 30 days).
set -euo pipefail
cd "$(dirname "$0")"
set -a; source .env; set +a

dir=/var/backups/co2tracker
file="co2tracker-$(date -u +%Y%m%dT%H%M%SZ).dump"

docker compose exec -T postgres pg_dump -U co2tracker -d co2tracker -Fc --no-owner > "$dir/$file"
[ -s "$dir/$file" ] || { echo "empty dump"; exit 1; }

docker run --rm -v "$dir:/backups:ro" \
  -e AWS_ACCESS_KEY_ID="$OCI_S3_ACCESS_KEY" -e AWS_SECRET_ACCESS_KEY="$OCI_S3_SECRET_KEY" \
  -e AWS_REQUEST_CHECKSUM_CALCULATION=when_required -e AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
  --entrypoint sh amazon/aws-cli:2.22.35 -c "
    aws configure set default.s3.addressing_style path &&
    aws s3 cp /backups/$file s3://$OCI_BUCKET/postgres/$file \
      --endpoint-url https://$OCI_NAMESPACE.compat.objectstorage.$OCI_REGION.oraclecloud.com --region $OCI_REGION"

find "$dir" -name 'co2tracker-*.dump' -mtime +"${BACKUP_KEEP_LOCAL_DAYS:-7}" -delete
echo "$(date -u +%FT%TZ) uploaded $file"
