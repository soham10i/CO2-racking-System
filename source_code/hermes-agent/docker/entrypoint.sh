#!/bin/sh
set -eu
: "${MERCURY_API_KEY:?MERCURY_API_KEY must be set (from .env locally, Secret Manager on Cloud Run)}"
: "${API_SERVER_KEY:?API_SERVER_KEY must be set (>= 8 chars; clients send it as a Bearer token)}"
export MERCURY_BASE_URL="${MERCURY_BASE_URL:-https://api.inceptionlabs.ai/v1}"
export MERCURY_MODEL="${MERCURY_MODEL:-mercury-2}"
# Cloud Run injects PORT; Hermes reads API_SERVER_PORT.
export API_SERVER_PORT="${API_SERVER_PORT:-${PORT:-8642}}"
mkdir -p "$HERMES_HOME"
# Seed config on first start (Cloud Run's filesystem is ephemeral, so this runs per instance).
[ -f "$HERMES_HOME/config.yaml" ] || cp /opt/hermes-defaults/config.yaml "$HERMES_HOME/config.yaml"
exec "$@"
