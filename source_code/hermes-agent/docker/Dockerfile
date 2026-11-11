# syntax=docker/dockerfile:1.7
# Hermes Agent (Nous Research) on a slim Python base, pointed at Mercury (Inception Labs).
# Upstream refuses to build wheels, so we install from a pinned source checkout
# with `uv sync --frozen` (the same approach as upstream's own Dockerfile).

ARG PYTHON_IMAGE=python:3.13-slim-trixie
ARG HERMES_REF=v2026.9.24

FROM ${PYTHON_IMAGE} AS builder
ARG HERMES_REF
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/hermes/.venv UV_PYTHON=/usr/local/bin/python3
COPY --from=ghcr.io/astral-sh/uv:0.11.6 /uv /usr/local/bin/uv
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates build-essential \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch "${HERMES_REF}" https://github.com/NousResearch/hermes-agent /opt/hermes \
    && rm -rf /opt/hermes/.git
WORKDIR /opt/hermes
# Core deps from the lockfile, plus aiohttp (needed by the API-server gateway), pinned
# to the same version upstream pins in its [messaging] extra.
RUN uv sync --frozen --no-dev --no-install-project \
    && uv pip install --python /opt/hermes/.venv/bin/python --no-cache "aiohttp==3.14.3" \
    && uv pip install --python /opt/hermes/.venv/bin/python --no-cache --no-deps -e .

FROM ${PYTHON_IMAGE} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 hermes \
    && useradd --system --uid 10001 --gid hermes --home-dir /opt/data --create-home hermes
COPY --from=builder --chown=root:root /opt/hermes /opt/hermes
COPY --chown=root:root config/config.yaml /opt/hermes-defaults/config.yaml
COPY --chown=root:root --chmod=0755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh
ENV PATH=/opt/hermes/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    HERMES_HOME=/opt/data \
    API_SERVER_ENABLED=true \
    API_SERVER_HOST=0.0.0.0 \
    PORT=8642
USER 10001:10001
WORKDIR /opt/data
EXPOSE 8642
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import os,urllib.request,sys; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8642\")}/health', timeout=4); sys.exit(0)" || exit 1
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["hermes", "gateway", "run"]
