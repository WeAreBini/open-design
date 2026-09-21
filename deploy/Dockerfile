# We Are Bini hosted changes. Apache License 2.0.
# Copyright 2026 Open Design contributors.
# This image uses Debian so the GNU Claude binary runs without a volume glibc copy.
# Claude, Codex, Grok, and DeepSeek Harness (`dsh`) are installed in the image.
# Grok sign-in stays on the /app/.od volume. HTTP MCP is not started here.
ARG NODE_IMAGE=docker.io/library/node:24-bookworm-slim
ARG RUNTIME_IMAGE=docker.io/library/node:24-bookworm-slim

FROM ${NODE_IMAGE} AS build

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG http_proxy
ARG https_proxy
ARG no_proxy
ARG NO_PROXY

ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV http_proxy=${http_proxy}
ENV https_proxy=${https_proxy}
ENV no_proxy=${no_proxy}
ENV NO_PROXY=${NO_PROXY}
ENV CI=true

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts/postinstall.mjs ./scripts/postinstall.mjs
COPY packages ./packages
COPY tools ./tools
COPY apps/daemon/package.json ./apps/daemon/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY e2e/package.json ./e2e/package.json
RUN corepack enable && \
    corepack prepare pnpm@10.33.2 --activate && \
    pnpm install --frozen-lockfile

COPY apps ./apps
COPY deploy/hosted ./deploy/hosted
RUN pnpm --filter @open-design/daemon build && \
    pnpm --filter @open-design/web build && \
    pnpm --filter @open-design/dsh-runtime build && \
    mkdir -p /app/deploy/dsh-companion && \
    pnpm -C packages/dsh-runtime pack --pack-destination /app/deploy/dsh-companion && \
    node deploy/hosted/write-dsh-manifest.mjs /app/deploy/dsh-companion && \
    pnpm --filter @open-design/daemon deploy --legacy --prod /app/deploy/daemon && \
    pnpm store prune && \
    rm -rf \
      /root/.cache \
      /root/.local/share/pnpm/store \
      /app/deploy/daemon/node_modules/.cache \
      /app/deploy/daemon/node_modules/@types \
      /app/deploy/daemon/node_modules/.pnpm/@types+* \
      /app/deploy/daemon/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/deps \
      /app/deploy/daemon/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/src && \
    find /app/deploy/daemon/node_modules -type d \( \
      -name test -o \
      -name tests -o \
      -name "__tests__" -o \
      -name docs -o \
      -name doc -o \
      -name example -o \
      -name examples -o \
      -name ".github" \
    \) -prune -exec rm -rf '{}' + && \
    find /app/deploy/daemon/node_modules -type f \( \
      -name "*.md" -o \
      -name "*.markdown" -o \
      -name "*.d.ts" -o \
      -name "*.d.cts" -o \
      -name "*.d.mts" -o \
      -name "*.map" -o \
      -name "*.tsbuildinfo" -o \
      -name "binding.gyp" \
    \) -delete

# Stage-2 assets — copied into the build stage so the runtime stage
# can pull them via --from=build instead of reaching back into the
# build context.  This lets the Dockerfile work when the build context
# differs from the repo root (Railway, CI runners with a subdirectory
# context, etc.).
COPY skills ./skills
COPY design-systems ./design-systems
COPY craft ./craft
COPY prompt-templates ./prompt-templates
COPY assets ./assets
# `data/plugin-previews/manifest.json` is committed by the bake pipeline and is
# what `resolvePluginPreviewsDir()` looks for at runtime. Without it in the
# image, `loadManifest()` returns `{}` and every plugin silently falls back to
# the live-iframe preview path — the exact cost the bakes exist to avoid.
COPY data ./data
COPY plugins/_official ./plugins/_official

FROM ${RUNTIME_IMAGE}

RUN apt-get update && apt-get install -y --no-install-recommends \
      tini poppler-utils bash git ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 open-design \
    && useradd --system --uid 1001 --gid open-design --no-create-home --shell /usr/sbin/nologin open-design

COPY deploy/hosted /tmp/hosted
RUN node /tmp/hosted/install-clis.mjs && rm -rf /tmp/hosted
COPY deploy/hosted/entrypoint.sh /usr/local/bin/open-design-hosted-entrypoint
RUN chmod 755 /usr/local/bin/open-design-hosted-entrypoint

WORKDIR /app
COPY --from=build --chown=open-design:open-design /app/deploy/daemon ./apps/daemon
COPY --from=build --chown=open-design:open-design /app/apps/web/out ./apps/web/out
COPY --from=build --chown=open-design:open-design /app/skills ./skills
COPY --from=build --chown=open-design:open-design /app/design-systems ./design-systems
COPY --from=build --chown=open-design:open-design /app/craft ./craft
COPY --from=build --chown=open-design:open-design /app/prompt-templates ./prompt-templates
COPY --from=build --chown=open-design:open-design /app/data ./data
COPY --from=build --chown=open-design:open-design /app/assets/frames ./assets/frames
COPY --from=build --chown=open-design:open-design /app/assets/community-pets ./assets/community-pets
# Plan §3.J4 / spec §23.3.5 — bundled atom plugins registered on
# daemon boot. The directory contains `plugins/_official/atoms/<atom>/`
# pairs (SKILL.md + open-design.json); registerBundledPlugins() walks
# it on startup so the container ships with first-party atoms reachable
# via the same registry path third-party plugins use.
COPY --from=build --chown=open-design:open-design /app/plugins/_official ./plugins/_official
COPY --from=build --chown=open-design:open-design /app/deploy/dsh-companion /app/agent-runtimes/deepseek-harness

RUN mkdir -p /app/.od && \
    chown -R open-design:open-design /app

ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=192
ENV OD_BIND_HOST=0.0.0.0
ENV OD_PORT=7456
ENV PATH="/opt/hosted-clis/bin:${PATH}"
ENV CLAUDE_BIN=/opt/hosted-clis/bin/claude
ENV CODEX_BIN=/opt/hosted-clis/bin/codex
ENV DSH_BIN=/opt/hosted-clis/bin/dsh
ENV OD_AGENT_HOME=/app/.od/agent-home
ENV DSH_HOME=/app/.od/agent-home/.dsh

EXPOSE 7456

USER open-design
ENTRYPOINT ["/usr/local/bin/open-design-hosted-entrypoint"]
CMD ["node", "apps/daemon/dist/cli.js", "--no-open"]
