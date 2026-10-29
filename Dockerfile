# syntax=docker/dockerfile:1

# Single source: .bun-version. Bump both together (CI reads the file).
ARG BUN_VERSION=1.4.4

FROM oven/bun:${BUN_VERSION}-slim AS base
WORKDIR /app

# Dev dependencies, needed only to build. Keyed on the lockfile, so it stays cached until deps change.
FROM base AS deps
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
  bun install --frozen-lockfile

FROM base AS build
COPY --link --from=deps /app/node_modules ./node_modules
COPY . .
ENV NITRO_PRESET=node-server \
  NODE_ENV=production
# Build-only placeholders, scoped to this RUN. The origin must be non-loopback: production rejects loopback.
RUN PAYLOAD_SECRET=build-only-dummy-secret-override-at-runtime-1234567890 \
  DATABASE_URL=postgres://buildonly:buildonly@127.0.0.1:5432/buildonly \
  PAYLOAD_PUBLIC_SERVER_URL=https://example.com \
  PAYLOAD_BUNX_FLAGS=--bun \
  PAYLOAD_CLI_ARGS=--disable-transpile \
  bun run build

FROM base AS runner
# Payload's CLI (db:migrate) must run under Bun: the Node fallback cannot load the TS config.
ENV HOST=0.0.0.0 \
  PORT=3000 \
  NODE_ENV=production \
  PAYLOAD_BUNX_FLAGS=--bun \
  PAYLOAD_CLI_ARGS=--disable-transpile
WORKDIR /app

COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
  bun install --production --frozen-lockfile

# Owned by root and read-only to the `bun` user: the server never writes into its own code.
# `--link` cannot resolve user names, so these copies carry no --chown.
COPY --link --from=build /app/.output ./.output
COPY --link --from=build /app/src ./src
COPY --link tsconfig.json ./
# Runtime entrypoints: migrations, the channel worker, and the WebSocket gateway.
COPY --link drizzle ./drizzle
COPY --link scripts/migrate-business.ts scripts/channel-worker.ts scripts/realtime-ws.ts ./scripts/

USER bun

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "const r = await fetch('http://127.0.0.1:' + Bun.env.PORT + '/api/live'); process.exit(r.ok ? 0 : 1)"

CMD ["bun", ".output/server/index.mjs"]
