# last-notifications

Self-hosted, multi-tenant notification server. One instance serves many consuming sites ("apps"): each publishes notifications through a REST API, its users read them over REST + SSE/WebSocket, and closed tabs/email are reached by channel plugins running in a separate worker.

Channels in v1: **in-app**, **email** (SMTP), **browser push** (Web Push / VAPID), and **webhook** (a signed HTTPS POST to a URL the recipient's app stores). Vendor channels (Discord, RSS, SMS) are one plugin folder each — see [Channels](#channels).

Built on the bare Payload v4 + TanStack Start (RSC, Nitro) template: Payload keeps its CMS/admin at `/admin`, the notification console lives at `/dashboard`, and business data lives in a second Postgres database (better-auth identities, apps, API keys, notifications, deliveries).

## Quickstart

```bash
bun install
cp .env.example .env   # PAYLOAD_SECRET, DATABASE_URL, BUSINESS_DATABASE_URL, BETTER_AUTH_SECRET, PAYLOAD_PUBLIC_SERVER_URL
bun run db:up          # local Postgres on 127.0.0.1:5435 (demo/demo-secret-pw)
bun run db:migrate
bun run db:business:migrate
bun run dev            # http://localhost:3000
```

`bun run dev` runs the app (REST, SSE and the dashboard) and the email / Web Push delivery worker in one terminal. In a second shell, start the WebSocket gateway:

```bash
bun run ws:serve        # WebSocket gateway (:3001)
```

Open `/create-admin-user` to create the first admin, then `/dashboard`.

The compose Postgres creates `notifications_business` on an empty volume. On an existing volume create it once: `docker compose exec postgres createdb -U demo notifications_business`.

## Docs and API reference

- `/docs`: the guides (quickstart, authentication, publishing, recipient tokens, realtime, channels, self-hosting). Source is in `content/docs/`.
- `/api/reference`: interactive reference for the business API, generated from the route schemas. `/api/openapi.json` is the raw document.
- `/api/auth/reference`: the Better Auth reference. Turn off every OpenAPI surface by removing its entry in `src/server/openapi/config.ts`.

## How a notification flows

```
consumer site ──POST /api/v1/apps/<appKey>/notifications──> app
                                                             │ 1 tx
                                                             ├─ notifications          (inbox row)
                                                             └─ notification_deliveries (one per async channel)
                                                             │ after commit
                                                             ├─ in-process stream hub ──> SSE (:3000) / WS (:3001)
                                                             └─ NOTIFY notification_events ──> other instances + WS gateway

channels:work ── SELECT … FOR UPDATE SKIP LOCKED ──> channel.send() ──> SMTP / push endpoint
```

- The REST inbox is the source of truth; SSE and WS are transports over the same `(created_at, id)` cursor. A reconnect with `Last-Event-ID` (SSE) or `{"type":"resume","cursor"}` (WS) replays the gap.
- Async channels go through the outbox: `SKIP LOCKED` claims, a 60 s lease, exponential backoff, dead-letter after 8 attempts. Operators inspect and retry dead letters at `/dashboard/deliveries`.
- Publishes are idempotent per `dedupeKey`; a repeat returns the original id and enqueues nothing.

## API

Auth: app-bound keys (`lnk_…`, better-auth `@better-auth/api-key`) in `x-api-key` or `Authorization: Bearer`. Tenancy rides on `api_key_apps`, so a key can only act for its own app.

Permissions are `resource:verb` with CRUD verbs (`create`, `read`, `update`, `delete`). A verb never implies another, and keys can never manage keys. An app key acts only for its bound app.

| Permission | Grants |
|---|---|
| `apps:create` | refused on every key: apps are created in the dashboard |
| `apps:read`, `apps:update`, `apps:delete` | manage apps and their channel switches. Instance keys manage any app; an app key acts on its own app only |
| `notifications:create` | publish notifications |
| `notifications:read` | list a named recipient's inbox and unread count (`?recipient=`) |
| `notifications:update` | mark read, archive, restore (key callers name the recipient) |
| `notifications:delete` | delete a notification; key callers pass `?recipient=` |
| `tokens:create` | mint a browser token that reads one recipient's inbox |
| `recipients:read` | a recipient's masked contact, preference and push status; list recipients |
| `recipients:update` | set a recipient's contact, preferences, push subscriptions |
| `recipients:delete` | clear a recipient's contact; remove push subscriptions |
| `channels:read` | the app's delivery settings, never a secret |
| `channels:update` | the app's webhook endpoint; rotate its signing secret |

New keys expire after a year by default and are rate limited to 600 requests a minute by default. Both are set when the key is created. The recommended sets, and what each permission lets a key and a recipient token do, are in [`content/docs/permissions.mdx`](content/docs/permissions.mdx).

The dashboard's Create key form ticks what each feature needs: in-app (`notifications:create`, `tokens:create`, on by default), web push needs no extra permission (the subscription comes from the recipient's token), email needs `recipients:update` to store addresses, webhook needs `channels:update` and `recipients:update`.

Every route answers `{ data }` or `{ error: { code, message } }` with `x-request-id`; all `/api/**` responses are `no-store`.

| Route | Caller | Purpose |
|---|---|---|
| `POST /api/v1/apps/:appKey/notifications` | `notifications:create` | publish → `202 {id, duplicate, channels}` |
| `GET /api/v1/apps/:appKey/inbox?since&limit&order&before&view` | recipient token or `notifications:read` | in-app rows only: ascending keyset page `{items, next, total, unread, latest}`, each item `{id, type, title, body, data, priority, readAt, archivedAt, createdAt}` (`total` = every inbox row, `unread` = the badge); `order=desc` returns the newest page (no `since`), with `latest` as the stream resume cursor; `before=<next>` pages back to older rows; `view=archived` lists archived rows from the last 30 days |
| `POST /api/v1/apps/:appKey/inbox/read` | recipient token or `notifications:update` | `{ids}` or `{all:true}` |
| `POST /api/v1/apps/:appKey/inbox/archive` | recipient token or `notifications:update` | `{ids}` or `{read:true}` (archive all read); archiving also marks the rows read |
| `POST /api/v1/apps/:appKey/inbox/restore` | recipient token or `notifications:update` | `{ids}`; moves archived rows back to the inbox |
| `DELETE /api/v1/apps/:appKey/notifications/:id` | recipient token, or `notifications:delete` with `?recipient=` | remove one |
| `POST /api/v1/apps/:appKey/recipients/:recipientKey/token` | `tokens:create` | mint a 15-minute browser token for one recipient (shown once) |
| `GET /api/v1/apps/:appKey/stream?lastEventId` | recipient token (`?token=`) | SSE: `event: notification`, `id: <cursor>`; resume with `Last-Event-ID` or `?lastEventId=` |
| `WS :3001 /api/v1/apps/:appKey/ws?token=` | recipient token | `{type:"notification",cursor,notification}` |
| `POST /api/v1/apps/:appKey/push-subscriptions` | recipient token or `recipients:update` | register a browser subscription |
| `DELETE /api/v1/apps/:appKey/push-subscriptions` | recipient token or `recipients:delete` | remove a browser subscription |
| `GET /api/v1/apps/:appKey/webpush-public-key` | recipient token | VAPID `applicationServerKey` |
| `PUT /api/v1/apps/:appKey/recipients/:recipientKey/contact` | `recipients:update` (app key only; a recipient token cannot set it) | `{channel?: 'email'\|'webhook', address}` (`channel` defaults to `email`); a webhook URL must be `https` and public |
| `DELETE /api/v1/apps/:appKey/recipients/:recipientKey/contact?channel=` | `recipients:delete` | clears one contact channel; repeating it is safe |
| `PUT /api/v1/apps/:appKey/recipients/:recipientKey/preferences` | token self or `recipients:update` | `{channel, enabled}` opt-out |
| `GET /api/v1/apps/:appKey/recipients?limit&cursor` | `recipients:read` | keyset page of the app's recipient keys; `next` is the cursor |
| `GET /api/v1/apps/:appKey/recipients/:recipientKey` | `recipients:read` | masked email and webhook origin, push count, preferences (no raw addresses) |
| `GET /api/v1/apps/:appKey/channels` | `channels:read` | the app's delivery settings; never a secret |
| `PUT /api/v1/apps/:appKey/channels/webhook` | `channels:update` | `{endpointUrl \| null}`; the first call also issues the signing secret, returned once |
| `POST /api/v1/apps/:appKey/channels/webhook/secret` | `channels:update` | rotates the signing secret; the new one is returned once and the old one stops signing at once |
| `POST /api/v1/unsubscribe?...` | HMAC token in the URL | RFC 8058 one-click: turns email off. `GET` only shows a confirmation page and changes nothing |

Archived notifications are deleted 30 days after they were archived. The `view=archived` listing hides older rows immediately; the channel worker's hourly pass deletes them, so run `bun run channels:work` in production.

Recipient tokens (`lrt_…`, hashed at rest) exist so a browser never holds the app's publish key. The consuming site mints one server-to-server and hands it to its page; inbox, stream, push-subscribe, and preferences all accept it. Contact addresses need the app key. Browser calls are cross-origin: register the consuming site's origin on the app (`/dashboard/apps`) and those routes echo it, including `OPTIONS` preflight.

Admin routes (`/api/v1/admin/*`) are session-only for the dashboard — except the apps surface, which also accepts unbound `apps:*` keys as the machine path. Dashboard users must be the instance admin or an admin of ≥1 app.

### Publish body

```json
{
  "recipientKey": "user-42",
  "type": "comment.reply",
  "title": "New reply",
  "body": "Someone replied to your comment",
  "data": { "url": "https://app.example.com/thread/9" },
  "priority": 0,
  "channels": ["inapp", "email"],
  "dedupeKey": "reply-9",
  "email": "user@example.com"
}
```

`channels` defaults to `inapp`, `email` and `webpush`. `webhook` is opt-in: it is delivered only when a publish names it, so existing publishers never create webhook deliveries. A channel is dropped when the app switched it off (`/dashboard/apps`) or the recipient opted out. `email` is a one-shot address override for that delivery only. `data.url` becomes the email button; `data.<channel>` carries per-channel styling (see below).

## Channels

A channel plugin is a trusted server-side TypeScript module: no sandbox, no runtime loader. Installing one means adding it to `installedNotificationChannels` in `src/server/plugins/config.ts` and deploying.

```ts
type NotificationChannel = {
  id: string
  apiVersion: 1
  channel: NotificationChannelKind        // 'inapp' | 'email' | 'webpush' | 'webhook'
  migrations?: { folder: string; schema: string }
  describe: () => ChannelStatus           // enabled + human detail, never a secret
  send: (input: ChannelSendInput) => Promise<void>
}
```

Rules the host relies on:

- `id === channel`; ids match `^[a-z][a-z0-9-]{1,62}$`; duplicates and `apiVersion !== 1` throw at boot.
- Failures throw `ChannelError(code)` (e.g. `NO_RECIPIENT_ADDRESS`); the code lands in `last_error`, so a dead letter explains itself.
- Secrets come from the environment only (`definePluginConfig` + `secretFromEnv`); per-app tuning lives in `app_channels.config` and is non-secret.
- Presentation is per plugin and split by process: `describe()` returns the operator-facing `facts` (provider, endpoint, whether a secret is set — never the secret) rendered on the app's detail page, and an optional `<id>.panel.tsx` beside the plugin adds bespoke dashboard UI. Unregistered channels fall back to the shared panel shell.
- Styling is data: each plugin ships `<id>.style.ts` with a zod schema over `notification.data.<id>`. Email: `{theme:"default", accentColor?}`. Web Push: `{icon?, badge?, image?, actions?}`. Unknown keys are dropped, so an app cannot smuggle fields into a vendor payload.
- `migrations` points at a folder under `drizzle/plugins/<id>` applied by `db:business:migrate`; DDL never runs at app boot.

Existing plugins: `src/server/plugins/email/` (nodemailer SMTP, default theme, `List-Unsubscribe` one-click), `src/server/plugins/webpush/` (web-push + VAPID, 404/410 prunes the endpoint, failed endpoints purged after 60 days), and `src/server/plugins/webhook/`.

**Webhook.** The server POSTs JSON `{ id, type, title, body, data, priority, createdAt, recipientKey, app }` to the recipient's stored URL. Headers: `x-last-notifications-event` (the optional `data.webhook.event`, default `notification`), `x-last-notifications-delivery` (the notification id; use it to dedupe), and `x-last-notifications-signature: t=<unix>,v1=<hex>`, an HMAC-SHA256 of `<t>.<body>` with `WEBHOOK_SIGNING_SECRET`. Verify it and reject a `t` that is more than a few minutes old. Redirects are never followed. A URL that resolves to a private, loopback, link-local or metadata address is refused at connect time. 408, 429 and 5xx retry with backoff; other 4xx dead-letter at once.

## Environment

Payload keeps three keys: `PAYLOAD_SECRET`, `DATABASE_URL`, `PAYLOAD_PUBLIC_SERVER_URL` (loopback rejected in production).

Business/notification env is read lazily and only where needed:

| Key | Purpose |
|---|---|
| `BUSINESS_DATABASE_URL` | business DB (falls back to `DATABASE_URL`) |
| `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` (32+) | auth base URL + signing/secret key (also keys unsubscribe HMACs) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional Google sign-in pair |
| `AUTH_BOOTSTRAP_EMAIL` | only address allowed to sign up before an instance admin exists |
| `TURNSTILE_SECRET_KEY` / `TURNSTILE_SITE_KEY` | optional Cloudflare Turnstile pair; both turn on the sign-in challenge |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push (`bunx web-push generate-vapid-keys`) |
| `SMTP_PASS` | email channel password; provider, sender, and endpoint are configured in `src/server/plugins/email/email.config.ts` |
| `WEBHOOK_SIGNING_SECRET` | webhook channel HMAC key, 16+ characters; without it the webhook channel refuses to send |
| `WEBHOOK_ALLOW_PRIVATE` | development only: allow `http` and private-network webhook URLs (e.g. a local receiver) |
| `WS_PORT` | WebSocket gateway port (default 3001) |

A channel whose config is absent reports `enabled: false` in `/dashboard/apps` and publishes simply skip it.

Two traps worth knowing:

- A real environment variable always beats `.env`. A shell that exports `PAYLOAD_SECRET=` (empty) makes Payload fail with "PAYLOAD_SECRET is required" even though `.env` is filled — `unset PAYLOAD_SECRET DATABASE_URL` or `env -u PAYLOAD_SECRET -u DATABASE_URL bun run dev`.
- Never put `NODE_ENV` in `.env`: Bun loads it for `vite build`, so `NODE_ENV=development` compiles the SSR bundle with the dev JSX runtime and the production server then 500s every page. Leave it out (Vite defaults dev to development, build to production).

## Scripts

| Script | Purpose |
|---|---|
| `dev` | Vite dev server on :3000 |
| `build` / `start` | admin CSS → types → importmap → `vite build`; `start` runs the Nitro output for the active preset |
| `channels:work` | channel delivery worker (own process) |
| `ws:serve` | WebSocket gateway (own process, shares fan-out via LISTEN/NOTIFY) |
| `db:up` | local Postgres via `compose.yaml` (:5435) |
| `db:migrate` | Payload migrations |
| `db:business:generate` / `db:business:migrate` | drizzle-kit generate / apply for `drizzle/business` |
| `generate:types` / `generate:importmap` / `generate-routes` / `generate:payload-admin-css` | regenerate gitignored files |
| `smoke` | boot-contract check against a running server |
| `check` | `bun fmt --check` → Biome → `bun check --no-script` |
| `test` | `bun test` (unit + `*.integration.test.ts` against the business DB) |

## Structure

```
src/routes/                    __root, index, dashboard.{index,apps,apps_,api-keys,deliveries}, create-admin-user,
                               api.auth.$, api.session, api.initial-admin, api.v1.*, api.live, api.ready, api.$ (Payload)
src/server/
  auth/                        better-auth assembly (lnk_ keys), principal/resolve, registered origins
  db/                          schema/ (drizzle, one file per context), business-sql.ts, vocabularies.ts
  http/                        with-context, response envelope, validation, route guards, cors
  modules/
    notifications/{domain,application,infrastructure,http}   cursor, publish, repository, tokens, hub, bus, SSE
    apps/, api-keys/, admin/   tenancy repositories, key issuance/verification, dashboard guards
    stats/                     fleet + per-app dashboard aggregates (daily spine, channel/type/recipient breakdowns)
  plugins/                     notification-channels (contract), config (registry), channel-delivery (outbox),
                               plugin-config + with-timeout, email/, webpush/
  modules/health/              liveness + readiness (kernel slice)
src/components/dashboard/      shell, sidebar, login, access-denied, stats-panels (recharts), leaderboard
src/payload/                   Payload CMS (admin at /admin), unchanged template wiring
drizzle/business/              committed business migrations
scripts/                       channel-worker.ts, realtime-ws.ts, migrate-business.ts, smoke.ts, start.ts
tests/                         unit suites per module + notifications.integration.test.ts
```

## Deploy

- `docker compose up -d --build` builds and runs `migrate` → `app` + `worker` + `ws`; the bundled Postgres is only for local runs — point `DATABASE_URL`/`BUSINESS_DATABASE_URL` at a managed server in production.
- **SSE and WS need a long-lived server.** `NITRO_PRESET=node-server` (the Dockerfile default) is fine; the default `vercel` preset cannot hold a stream.
- Reverse proxies must not buffer the stream (`x-accel-buffering: no` is already sent) and must allow the WebSocket upgrade on `WS_PORT`.
- Run exactly one `channels:work`. Multiple workers are safe (the outbox claims with `SKIP LOCKED`), but they compete for the same rows.
- Web Push needs HTTPS on the consuming site; iOS delivers only to a home-screen-installed PWA. VAPID rotation forces every browser to resubscribe.
- Email deliverability is infrastructure: set SPF/DKIM/DMARC for the sender configured in `src/server/plugins/email/email.config.ts`. The one-click `List-Unsubscribe` header is emitted per message.

## Payload admin

`/admin` still serves the CMS (users collection only). Add a collection per the template recipe: `src/payload/collections/<name>.ts` → register in `payload.config.ts` → `bunx payload migrate:create` → `bun run db:migrate` → `bun run generate:types`. Business tables Payload never owns go under `src/server/modules/` on `getBusinessDb()` instead.
