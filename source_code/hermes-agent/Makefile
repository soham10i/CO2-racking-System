# Hermes Agent on Mercury: local + Google Cloud pipeline.
SHELL := /bin/bash
-include .env
-include deploy/gcp/config.env
export

IMAGE_LOCAL   ?= hermes-mercury-agent:local
GCP_REGION    ?= europe-west3
AR_REPO       ?= hermes
SERVICE       ?= hermes-agent
TAG           ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)
IMAGE_REMOTE   = $(GCP_REGION)-docker.pkg.dev/$(GCP_PROJECT_ID)/$(AR_REPO)/$(SERVICE):$(TAG)

# Use the mock unless a real key is present in .env.
COMPOSE = docker compose -f docker-compose.yml $(if $(strip $(MERCURY_API_KEY)),,-f docker-compose.mock.yml)
SMOKE_FLAGS = $(if $(strip $(MERCURY_API_KEY)),,--expect-mock)

.PHONY: help setup lint run-local stop logs test build gcp-setup deploy rollback validate clean

help:  ## List targets
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'

setup:  ## Create .env from the example (no overwrite) and check tools
	@test -f .env || { cp .env.example .env; echo "created .env (empty key = mock mode)"; }
	@command -v docker >/dev/null || { echo "docker is required"; exit 1; }
	@docker compose version >/dev/null

lint:  ## Lint Python, shell, Dockerfile, YAML (uses throwaway containers)
	docker run --rm -v "$$PWD":/src -w /src ghcr.io/astral-sh/ruff:0.14.0 check mock tests
	docker run --rm -v "$$PWD":/mnt -w /mnt koalaman/shellcheck:v0.11.0 docker/entrypoint.sh deploy/gcp/*.sh
	docker run --rm -i hadolint/hadolint:v2.14.0 hadolint --ignore DL3008 - < docker/Dockerfile
	docker run --rm -v "$$PWD":/w -w /w python:3.13-slim-trixie sh -c "pip install -q --root-user-action=ignore yamllint==1.37.1 && yamllint -d relaxed docker-compose.yml docker-compose.mock.yml cloudbuild.yaml config/config.yaml"

run-local: setup  ## Build and start the agent locally on http://localhost:8642
	$(COMPOSE) up -d --build
	@echo "agent: http://localhost:8642  (mode: $(if $(strip $(MERCURY_API_KEY)),Mercury,mock))"

stop:  ## Stop local containers
	$(COMPOSE) down

logs:  ## Follow agent logs
	$(COMPOSE) logs -f agent

test: run-local  ## End-to-end smoke test against the local container
	set -a; . ./.env; set +a; python3 tests/smoke_test.py --url http://localhost:8642 $(SMOKE_FLAGS)

build:  ## docker build the image
	docker build -f docker/Dockerfile -t $(IMAGE_LOCAL) .

gcp-setup:  ## One-time GCP setup (creates billable resources; asks first)
	./deploy/gcp/setup.sh

deploy:  ## Build in Cloud Build, push to Artifact Registry, deploy to Cloud Run
	@test -n "$(GCP_PROJECT_ID)" || { echo "set GCP_PROJECT_ID in deploy/gcp/config.env"; exit 1; }
	gcloud builds submit --project "$(GCP_PROJECT_ID)" --region "$(GCP_REGION)" --config cloudbuild.yaml \
	  --substitutions=_REGION=$(GCP_REGION),_AR_REPO=$(AR_REPO),_SERVICE=$(SERVICE),_TAG=$(TAG) .

rollback:  ## Send 100% traffic to a revision: make rollback REVISION=hermes-agent-000xx-abc
	@test -n "$(REVISION)" || { gcloud run revisions list --service $(SERVICE) --region $(GCP_REGION) --project $(GCP_PROJECT_ID); echo "pass REVISION=..."; exit 1; }
	gcloud run services update-traffic $(SERVICE) --region $(GCP_REGION) --project $(GCP_PROJECT_ID) --to-revisions $(REVISION)=100

validate:  ## Offline checks of the deploy files (no cloud calls)
	./deploy/gcp/validate.sh

clean: stop  ## Remove local image and volume
	-docker compose -f docker-compose.yml -f docker-compose.mock.yml down -v
	-docker image rm $(IMAGE_LOCAL)
