# Hermes Agent on Mercury

[Hermes Agent](https://github.com/NousResearch/hermes-agent) (Nous Research) runs here as an
OpenAI-compatible HTTP API (its `api_server` gateway). It is backed by
[Mercury](https://docs.inceptionlabs.ai/get-started), the diffusion LLM from Inception Labs.
The agent runs locally in Docker and deploys to Google Cloud Run.
This folder stands alone; nothing here depends on the CO2 tracker.

```
client ──Bearer API_SERVER_KEY──▶ Hermes gateway (:8642 local / :8080 Cloud Run)
                                     └──Bearer MERCURY_API_KEY──▶ https://api.inceptionlabs.ai/v1
```

| Piece | Pinned to | Source |
|---|---|---|
| Hermes Agent | git tag `v2026.9.24` (`HERMES_REF` build arg) | GitHub tags; the image's `/health` reports `version 0.21.5` (**verify** how the tag maps to the release) |
| Python | `python:3.13-slim-trixie` | that tag's `pyproject.toml` requires `>=3.11,<3.14` |
| Mercury base URL | `https://api.inceptionlabs.ai/v1` | Inception docs |
| Mercury model | `mercury-2` (env `MERCURY_MODEL`) | official `/v1/models` lists `mercury-2` and `mercury-edit-2`. Newer ids like `mercury-3` appear only on third-party sites (**verify** with `GET /v1/models`) |
| Rate limits | not published | Inception FAQ: retry with backoff on 429/503 and contact support for higher limits |

## Layout

```
config/config.yaml        Hermes config: provider=custom, base_url/model/key from env
docker/Dockerfile         multi-stage, slim base, non-root uid 10001, HEALTHCHECK on /health
docker/entrypoint.sh      checks required env, maps $PORT→API_SERVER_PORT, seeds config
docker-compose.yml        local agent (bound to 127.0.0.1 only)
docker-compose.mock.yml   adds mock Mercury; used automatically when MERCURY_API_KEY is empty
mock/mock_mercury.py      stdlib OpenAI-compatible stub (checks the Bearer key it receives)
tests/smoke_test.py       end to end: /health → wrong key gets 401 → chat completion
cloudbuild.yaml           lint → test → build → push → deploy
deploy/gcp/setup.sh       one-time GCP setup (APIs, registry, secrets, service accounts, IAM, WIF)
deploy/gcp/validate.sh    offline checks of the deploy files
../.github/workflows/hermes-agent.yml   GitHub Actions with Workload Identity Federation
```

## Local quickstart

```bash
cd hermes-agent
make setup        # creates .env from .env.example (git-ignored)
make run-local    # builds the image and starts it on http://localhost:8642
make test         # smoke test; uses the mock unless MERCURY_API_KEY is set in .env
```

To use the real Mercury API, put your key in `.env` as `MERCURY_API_KEY=...` (only there),
then run `make stop run-local test` again. Call the agent like this:

```bash
curl -s localhost:8642/v1/chat/completions -H "Authorization: Bearer $API_SERVER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"hermes-agent","messages":[{"role":"user","content":"Hello"}]}'
```

Other targets: `make logs`, `make stop`, `make build`, `make lint`, `make validate`, `make clean`.

## Google Cloud: one-time setup

Defaults: region **`europe-west3`** (Frankfurt), **min 0 / max 2 instances**, 1 vCPU, 1 GiB,
concurrency 10, 600 s request timeout.

```bash
cp deploy/gcp/config.env.example deploy/gcp/config.env   # edit the project id, region, repo
make gcp-setup
```

`setup.sh` is idempotent and asks you to type the project id before it changes anything. It:

1. Enables the Run, Artifact Registry, Cloud Build, Secret Manager, IAM, IAM Credentials and STS APIs.
2. Creates the Docker repo `hermes` in Artifact Registry.
3. Creates the secrets `hermes-mercury-api-key` and `hermes-api-server-key`. It reads their values
   from a hidden prompt and pipes them in on stdin, so they never appear in argv, shell history or git.
4. Creates two service accounts:
   - `hermes-agent-run` is the runtime identity. Its only grant is `secretAccessor` on those two secrets.
   - `hermes-agent-deploy` is the CI/deploy identity. It gets `artifactregistry.writer` on the repo,
     `run.developer` and `logging.logWriter` on the project, and `iam.serviceAccountUser` on the
     runtime SA only.
5. Optionally sets up GitHub Workload Identity Federation: a pool and an OIDC provider restricted
   to `GITHUB_REPO`, plus `workloadIdentityUser` on the deployer SA. It prints the repo variables
   to set: `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WIF_PROVIDER`, `GCP_DEPLOYER_SA`.
   No JSON keys are created.

## Deploy

- **From your machine** (Cloud Build): run `make deploy`. It wraps
  `gcloud builds submit --config cloudbuild.yaml`. To have Cloud Build run as the deployer
  instead of the default build SA, add
  `--service-account=projects/$P/serviceAccounts/hermes-agent-deploy@$P.iam.gserviceaccount.com`.
  You must be allowed to act as that account.
- **From GitHub**: a push to `main` that touches `hermes-agent/**` runs lint, then the mocked
  smoke test, then build and push to Artifact Registry, then `gcloud run deploy`. The deploy job
  uses the `production` environment, so you can add required reviewers there.

The secrets reach the container at runtime through `--set-secrets`. They are never in the image,
the build args, or `cloudbuild.yaml`.

### Access

The service deploys with `--no-allow-unauthenticated`, so callers need Cloud Run IAM
(`roles/run.invoker`) **and** the agent's own `API_SERVER_KEY`. There is one catch: Cloud Run IAM
and Hermes both read the `Authorization` header. Choose one of these:
- Make it public, which is simplest: redeploy with `--allow-unauthenticated` and rely on
  `API_SERVER_KEY` alone. Setting that IAM policy needs `run.admin` (run.developer can't set it),
  and some org policies block `allUsers`.
- Keep IAM: put an API gateway or IAP in front, or have callers send the Cloud Run identity token
  in `X-Serverless-Authorization`, which Cloud Run accepts, while `Authorization` carries the
  Hermes key. **Verify** that header against the Cloud Run docs for your setup.

The agent can run tools and terminal commands. Hermes warns at startup that the API server is
network-accessible with an unsandboxed `local` terminal backend. On Cloud Run the container is
the sandbox, it runs non-root, and the filesystem is ephemeral. Even so, don't expose it without
a strong key.

## Rollback

```bash
make rollback                                  # lists revisions
make rollback REVISION=hermes-agent-00007-abc  # sends 100% of traffic to that revision
```

Cloud Run keeps old revisions. Images in Artifact Registry are tagged with the git SHA, so a
rollback never needs a rebuild.

## Cost notes

Prices change, so check them on the official pricing pages: Cloud Run, Artifact Registry,
Secret Manager, Cloud Build, and Inception's own pricing.
- `MIN_INSTANCES=0` scales to zero, so an idle service costs about nothing apart from image
  storage and secret versions. Setting it to 1 removes cold starts but bills for an always-on instance.
- `MAX_INSTANCES=2` caps both Cloud Run spend and how many concurrent Mercury calls an abuser can
  cause. Mercury usage is billed per token by Inception, separately from GCP.
- The image is about 740 MB. Old images build up in Artifact Registry, so add a cleanup policy.
- Agent sessions and memory live on the ephemeral disk and are lost when an instance stops.
  Persisting them would need a GCS or Filestore volume mount, which isn't included.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Container exits with `MERCURY_API_KEY must be set` | `.env` is missing the key or Secret Manager isn't wired. In mock mode compose sets it for you. |
| 401 from the agent | Wrong `Authorization: Bearer <API_SERVER_KEY>`, or Cloud Run IAM rejected the call first (see Access). |
| 401 from Mercury in the logs | Bad key or missing secret version: `gcloud secrets versions list hermes-mercury-api-key`. |
| 429 / 503 from Mercury | Rate limited. Back off and retry, or ask Inception for higher limits. |
| `Could not determine context length for model 'mercury-2'` | Harmless; Hermes falls back to 256k. Set `model.context_length` in `config/config.yaml` once you know Mercury's real value. |
| `SQLite ... WAL-reset corruption bug` warnings | Debian trixie ships SQLite 3.46.1; Hermes switches to `journal_mode=DELETE` safely. The upstream image bundles a newer SQLite if you need WAL. |
| `boto3 lazy install did not complete` | Only matters for the Bedrock provider; ignore it. |
| Cloud Run says the container failed to listen on `$PORT` | The entrypoint maps `PORT` to `API_SERVER_PORT`; check that you didn't override `API_SERVER_PORT`. |
| Build fails in `uv sync` | `HERMES_REF` was bumped to a version that needs a different Python. Match `PYTHON_IMAGE` to its `requires-python`. |

`gcloud builds submit` has no dry-run flag. `make validate` checks the deploy files offline
instead: YAML parses, the step order is right, shell syntax is valid, and no secrets are tracked.
