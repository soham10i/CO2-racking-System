#!/usr/bin/env bash
# Offline validation of the deploy files. Makes NO calls that create or change cloud resources.
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 - <<'PY'
import sys, yaml
for f in ["cloudbuild.yaml", "../.github/workflows/hermes-agent.yml", "docker-compose.yml",
          "docker-compose.mock.yml", "config/config.yaml"]:
    yaml.safe_load(open(f)); print("yaml ok:", f)
cb = yaml.safe_load(open("cloudbuild.yaml"))
ids = [s.get("id") for s in cb["steps"]]
assert ids == ["lint", "test", "build", "push", "deploy"], ids
assert "MERCURY_API_KEY=" not in open("cloudbuild.yaml").read().replace("MERCURY_API_KEY=hermes", "")
print("cloudbuild steps:", ids)
PY
bash -n deploy/gcp/setup.sh docker/entrypoint.sh && echo "bash syntax ok"
if git grep -nIE '(sk-[A-Za-z0-9]{20,}|MERCURY_API_KEY=[^$ ]{8,})' -- . ':!*.example' ':!deploy/gcp/validate.sh' ; then
  echo "possible secret committed"; exit 1; fi
echo "no secrets found in tracked files"
