# Changelog

## v0.1.0

Inbox is the in-app surface, and the inbox exposes what a bell needs.

### Database (breaking for existing business databases)

- **Rebuilt business migrations, one per domain.** The schema is `drizzle/business/0000_auth.sql`, `0001_tenancy.sql`, `0002_recipients.sql`, `0003_notifications.sql` and `0004_channels.sql`, in that order. Each matches a module in `src/server/db/schema/`. The nine earlier files are gone, so an existing business database cannot upgrade in place. Recreate `BUSINESS_DATABASE_URL` and run `bun run db:business:migrate`. Payload's `DATABASE_URL` database is not touched.
- **Keys from before the CRUD rename are not upgraded.** The migrate job no longer rewrites legacy `write` permissions. Reissue such keys.
- **Recipients are a table.** `recipients(app_id, recipient_key)` is written by every recipient-scoped call. Deleting a row cascades to its notifications, contacts, preferences, tokens and push subscriptions. Listing recipients reads this table, so a recipient that only ever received an inbox notification now appears.
- **`recipient_channels` is `recipient_contacts`.** `verified_at` is dropped, since nothing wrote it.
- **Push endpoints are unique per app.** A browser subscription can no longer move from one app to another.
- **Channel names are not CHECK constraints.** The zod enums and the plugin registry validate them, so adding a channel needs no migration.
- **Indexes.** The inbox and archive views, both retention purges and the recipient-token expiry purge each have an index they lacked. Dropped the redundant `recipient_tokens` token index, since the hash is the primary key now.
- **One-shot email address.** Cleared once the email is delivered. A dead-lettered email keeps it, so a requeue still sends to the address the publisher gave.

### API reference and docs

- **OpenAPI.** `GET /api/openapi.json` describes every `/api/v1` route with its request and response schemas, request schemas are the ones the routes validate with, and response shapes are declared beside them and checked by the test suite for the inbox, recipient, channel and token routes. The interactive reference is at `/api/reference`, served with a self-hosted Scalar bundle.
- **Auth reference.** Better Auth's OpenAPI plugin is mounted at `/api/auth/reference`. Delete its entry in `src/server/openapi/config.ts` to turn off every OpenAPI surface.
- **Docs site.** Fumadocs serves the guides at `/docs`, with search at `/api/search`. The guides cover authentication, publishing, recipient tokens, realtime, channels, plugins, self-hosting and errors.

### Host API and CRUD permissions

The host registers its delivery settings and manages recipients through the widget's server SDK. The server stores and delivers.

- **Permissions are CRUD.** Each is `resource:verb` with `create`, `read`, `update` or `delete`. `notifications:write` is gone: publish is `notifications:create`, mark read and archive are `notifications:update`, delete is `notifications:delete`, and minting browser tokens is `tokens:create`. `subscribers` is renamed `recipients`. Keys issued before this change are upgraded in place by the migrate job and keep every ability they had.
- **Keys expire and are rate limited.** Dashboard keys default to one year and 600 requests a minute, both set at creation. A rate-limited request gets `RATE_LIMITED` (429).
- **Per-app webhook endpoint and signing secret.** `PUT /api/v1/apps/:appKey/channels/webhook` sets the endpoint and issues the secret once. `POST …/channels/webhook/secret` rotates it. The secret is sealed with `SECRET_ENCRYPTION_KEY`. Deliveries go to the recipient's own URL, else to the app endpoint.
- **Recipient management.** Read one recipient (masked), list recipients (keyset), and clear one contact channel.
- **Migration 0007** adds `app_channels.signing_secret_encrypted`. The migrate job applies it and runs the permission upgrade, before the app starts.

### Added

- `notifications.inapp` column (migration `0004`, default `true`). Publish sets it from the resolved channels, so an email-only notification no longer appears in the inbox, the unread count or the stream.
- Inbox `order=desc` (newest page, no `since`), `unread` count and `latest` stream cursor in the inbox response.
- SSE `lastEventId` query parameter, for browsers whose `EventSource` cannot set `Last-Event-ID`. A malformed cursor is a 400 before the stream opens.

### Inbox item fields

- **Changed.** Inbox rows, the SSE `notification` frame and the WebSocket `notification` frame now carry only `id`, `type`, `title`, `body`, `data`, `priority`, `readAt`, `archivedAt` and `createdAt`. `appId`, `recipientKey` and `dedupeKey` are no longer sent. The bell does not read them; any other client that did must stop.

### Webhook channel

A signed HTTPS POST per recipient, as a new delivery channel.

- **New migration.** `drizzle/business/0005_worried_cerebro.sql` widens the four channel CHECK constraints and narrows `recipient_channels` to `email` and `webhook`. Run `bun run db:business:migrate`.
- **Opt-in.** `channels` now defaults to `inapp`, `email` and `webpush`. Webhook is delivered only when a publish names it, so existing publishers create no webhook deliveries.
- **Contacts.** `PUT …/contact` takes `{channel?: 'email' | 'webhook', address}`. `channel` defaults to `email`, so `{address}` still works. A webhook URL needs an app key with `subscribers:write`; a recipient token cannot set it.
- **Signing and safety.** Set `WEBHOOK_SIGNING_SECRET` (16+ characters); the channel refuses to send without it. Connect-time DNS checks refuse private, loopback, link-local and metadata addresses. `WEBHOOK_ALLOW_PRIVATE=true` is for development only.
- **Retry policy.** `ChannelError` carries `retryable`. A non-retryable failure (for example a 404 receiver) dead-letters on its first attempt instead of after eight.

### Inbox archive

Archive, restore and archive-all-read for the in-app inbox, with 30-day retention.

- **New migration.** `drizzle/business/0006_tired_thunderbolt_ross.sql` adds `notifications.archived_at` and a partial index on archived rows. Run `bun run db:business:migrate`.
- **Archiving marks read.** Archived rows leave the default inbox and the unread count. `POST …/inbox/archive` takes `{ids}` or `{read: true}` (archive all read); `POST …/inbox/restore` takes `{ids}`.
- **Archived listing.** `GET …/inbox?view=archived` lists the last 30 days of archived rows. `before=<next>` pages back through `order=desc` results, so large inboxes load one page at a time.
- **Retention.** Archived rows older than 30 days are deleted by the worker's hourly pass (`purgeExpiredState`). The archived view hides them at once, so the UI stays correct even when the worker is down.
