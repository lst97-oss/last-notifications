# src/server — business backend kernel

## Role / pipeline position

Business logic lives here, DDD-style, behind thin TanStack Start route adapters in `src/routes/api.*.ts` (routes extract data fns, wrap with `withContext`, never contain logic). Sibling `src/payload/` owns the CMS; this tree owns everything else.

Module map — `http/`: `errors.ts` (`ErrorCode`, `HttpError`, `toHttpError`), `response.ts` (`ok`/`fail` envelope), `with-context.ts` (requestId, logging, `withAuth` stub; passes through handler-built `Response`s), `validation.ts` (`parseWith` zod → 400 `VALIDATION_ERROR`); `observability/logger.ts` (structured console, sink-injectable); `db/business-sql.ts` (lazy Bun SQL + Drizzle seam); `config/business-env.ts` (lazy connection string); `env.ts` (required boot env, dual-runtime); `security/payload-server-url.ts` (loopback guard); `modules/<name>/{domain,application,infrastructure,http}` (one bounded context per dir; `health` is the reference slice: live liveness + ready readiness).

`openapi/` is the spec: `registry.ts` (every route), `response-schemas.ts` (response shapes; `notificationSchema` is the inbox item), `reference.ts` (the two pages), `config.ts` (the on/off switch). Inbox rows and frames go out through `modules/notifications/http/inbox-item.ts` (`toInboxItem`), shared by REST, SSE and the WS gateway.

## Invariants

- Layer direction: `http → application → domain`; ports (e.g. `DbProbe`) are declared in `application`, implemented in `infrastructure`. Domain stays pure.
- Envelope is fixed: `ok()` → `{ data }`, `fail()` → `{ error: { code, message } }`, `cache-control: no-store` default. Never hand-roll `Response.json` in modules.
- `HttpError.expose` defaults to `status < 500`: 5xx wire messages are generic; the real message goes to logs only.
- Status numbers and standard error codes come from `@lst97-oss/last-httprism` (`HttpStatus`, `MessageCode`) or `ErrorCode` (app codes in `http/errors.ts`). Never hand-type a status number or a standard code.
- `withContext` never throws and always echoes `x-request-id` (inbound header or `crypto.randomUUID()`); live/ready probes stay outside `withAuth`. Handler-built `Response`s pass through (ready's 200|503 preserved); plain data gets the `ok()` envelope.
- Input validation uses `parseWith(schema, input)` only (`validation.ts` also holds `parseJsonBody`, `parseSearchParams`, `parsePaginationParams`) — zod failures throw `HttpError(ErrorCode.VALIDATION_ERROR, '<path>: <message>; …')` (`expose: true`). Malformed JSON bodies are 400 `MALFORMED_JSON`. Pagination: limit 1–100 default 20, offset ≥ 0 default 0, enforced not clamped. No per-module 400 mapping.
- Liveness vs readiness: `/api/live` never touches I/O (always 200 when the process is alive); `/api/ready` is the DB-backed probe (503 when degraded). Liveness checks must never probe the DB — a DB outage must not kill-loop the container.
- Probes/adapters never reject: failures resolve to `{ ok: false, ... }` so use cases need no try/catch of their own.
- Dual-runtime: `env.ts` + `config/business-env.ts` (Payload Node-CLI graph) stay Bun/Node-safe (`typeof Bun` guards); `db/business-sql.ts` is Bun-only — never import it from that graph.
- `getServerEnv()` gains no new required keys; business config resolves lazily via `getBusinessEnv()` (`BUSINESS_DATABASE_URL`, else `DATABASE_URL`).
- One shared client: new modules reuse `getBusinessSql()` / `getBusinessDb()`; no per-module pools, env parsing, or migration runners (business tables never go through Payload `prodMigrations`).
- Tests mirror the basename under `tests/`, inject fakes via deps params, never `mock.module`. TDD red → green per slice.
- Do-not-"fix" seams: `getBusinessDb()` is callerless until the first table-backed module — keep it; `withAuth` is a 501 stub marking the Better Auth seam — don't call it; `health` is unauthenticated by design.
- No Hono, no CMS imports in the generic kernel files: CMS-only extras here are `env.ts` (extends the base env with `PAYLOAD_*` keys), and the Payload drain in `src/payload/payload-shutdown.ts`; the Payload origin guard lives in `src/payload/security/payload-server-url.ts`. The generic kernel files arrive via the kernel-sync workflow (see `scripts/kernel-sync.json`) — change the kernel in `last-tanstack-start-template` first, never hand-edit synced files.

## Conventions

- New-module recipe: `domain/` types + pure fns → `application/` use case with deps param → `infrastructure/` adapters → `http/` split of `getXData` (data) + `handleXGet` (`ok`-wrapped) → route `GET: (ctx) => withContext(async () => getXData())(ctx)`, keeping the literal `server:` key.
- Log events: `request.start { requestId, method, path }`, `request.complete { requestId, status, latencyMs }`, `request.error { requestId, code, status }`; scope via `logger.child({ requestId })`. Levels: `request.start` is `debug`; log outcomes, not every step. `LOG_LEVEL` sets the floor (default `info`); `LOG_FORMAT` picks pretty or JSON output and `LOG_COLOR` picks colour (both default `auto`; see `logger-settings.ts`). Failed deliveries are `warn`, a worker that cannot poll is `error` with a backoff.
- Units: `latencyMs` numbers, `uptimeSeconds` integers; probe timeout 2000 ms (`DB_PROBE_TIMEOUT_MS`).
- Style: 2-space, 120 cols, single quotes, semicolons as-needed (Biome); lazy singletons, no import-time side effects.
