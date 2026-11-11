#!/usr/bin/env bash
# One-time Google Cloud setup for the Hermes agent. Idempotent: re-running skips what exists.
# Creates: APIs, Artifact Registry repo, 2 secrets (empty), 2 service accounts, IAM bindings,
# and (optionally) a GitHub Workload Identity Federation pool. Secrets VALUES are never passed
# on the command line; you are prompted with hidden input.
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck disable=SC1091
source ./config.env
P="$GCP_PROJECT_ID"; R="$GCP_REGION"
RUN_SA_EMAIL="${RUNTIME_SA}@${P}.iam.gserviceaccount.com"
DEP_SA_EMAIL="${DEPLOYER_SA}@${P}.iam.gserviceaccount.com"
g() { gcloud --project "$P" "$@"; }

echo "Project: $P  Region: $R"
echo "This enables APIs and creates billable resources (Artifact Registry storage, Secret Manager)."
read -r -p "Type the project id to continue: " ok; [ "$ok" = "$P" ] || { echo aborted; exit 1; }

g services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com \
  secretmanager.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com

g artifacts repositories describe "$AR_REPO" --location "$R" >/dev/null 2>&1 || \
  g artifacts repositories create "$AR_REPO" --location "$R" --repository-format docker \
    --description "Hermes agent images"

for sa in "$RUNTIME_SA" "$DEPLOYER_SA"; do
  g iam service-accounts describe "${sa}@${P}.iam.gserviceaccount.com" >/dev/null 2>&1 || \
    g iam service-accounts create "$sa" --display-name "$sa"
done

add_secret() {  # name, prompt
  g secrets describe "$1" >/dev/null 2>&1 || g secrets create "$1" --replication-policy automatic
  if [ -z "$(g secrets versions list "$1" --filter=state=ENABLED --format='value(name)' --limit 1)" ]; then
    read -r -s -p "$2: " val; echo
    printf '%s' "$val" | g secrets versions add "$1" --data-file=-
    unset val
  fi
  # Runtime SA may read only these two secrets.
  g secrets add-iam-policy-binding "$1" --member "serviceAccount:$RUN_SA_EMAIL" \
    --role roles/secretmanager.secretAccessor >/dev/null
}
add_secret hermes-mercury-api-key "Mercury API key (hidden)"
add_secret hermes-api-server-key "Agent API bearer key, >=8 chars (hidden; e.g. output of: openssl rand -hex 32)"

# Deployer: push images, deploy Cloud Run, act as the runtime SA, write build logs.
g artifacts repositories add-iam-policy-binding "$AR_REPO" --location "$R" \
  --member "serviceAccount:$DEP_SA_EMAIL" --role roles/artifactregistry.writer >/dev/null
for role in roles/run.developer roles/logging.logWriter; do
  g projects add-iam-policy-binding "$P" --member "serviceAccount:$DEP_SA_EMAIL" --role "$role" \
    --condition None >/dev/null
done
g iam service-accounts add-iam-policy-binding "$RUN_SA_EMAIL" \
  --member "serviceAccount:$DEP_SA_EMAIL" --role roles/iam.serviceAccountUser >/dev/null
# Needed only if you want --allow-unauthenticated (sets allUsers invoker on the service):
# run.developer cannot set IAM policy, so grant run.admin on the service after first deploy, or
# do the first deploy as yourself. See README "Access".

read -r -p "Set up GitHub Actions Workload Identity Federation for $GITHUB_REPO? [y/N] " yn
if [[ "$yn" =~ ^[Yy]$ ]]; then
  PN=$(g projects describe "$P" --format 'value(projectNumber)')
  g iam workload-identity-pools describe "$WIF_POOL" --location global >/dev/null 2>&1 || \
    g iam workload-identity-pools create "$WIF_POOL" --location global --display-name "GitHub"
  g iam workload-identity-pools providers describe "$WIF_PROVIDER" --location global \
      --workload-identity-pool "$WIF_POOL" >/dev/null 2>&1 || \
    g iam workload-identity-pools providers create-oidc "$WIF_PROVIDER" --location global \
      --workload-identity-pool "$WIF_POOL" --issuer-uri "https://token.actions.githubusercontent.com" \
      --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
      --attribute-condition "assertion.repository == '${GITHUB_REPO}'"
  g iam service-accounts add-iam-policy-binding "$DEP_SA_EMAIL" --role roles/iam.workloadIdentityUser \
    --member "principalSet://iam.googleapis.com/projects/${PN}/locations/global/workloadIdentityPools/${WIF_POOL}/attribute.repository/${GITHUB_REPO}" >/dev/null
  echo "GitHub repo variables to set:"
  echo "  GCP_WIF_PROVIDER=projects/${PN}/locations/global/workloadIdentityPools/${WIF_POOL}/providers/${WIF_PROVIDER}"
  echo "  GCP_DEPLOYER_SA=${DEP_SA_EMAIL}  GCP_PROJECT_ID=${P}  GCP_REGION=${R}"
fi
echo "Done."
