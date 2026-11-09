import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi'
import { HttpStatus } from '@lst97-oss/last-httprism'
import { z } from 'zod'

import {
  appCreateSchema,
  appUpdateSchema,
  channelPatchSchema,
  deliveriesQuerySchema,
  keyCreateSchema,
  keyDeleteQuerySchema,
  keyUpdateSchema,
  statsQuerySchema,
} from '@/server/modules/admin/http/admin-schemas'
import {
  archiveBodySchema,
  contactBodySchema,
  contactClearQuerySchema,
  inboxQuerySchema,
  inboxReadBodySchema,
  preferencesBodySchema,
  publishBodySchema,
  pushSubscriptionBodySchema,
  pushUnsubscribeBodySchema,
  recipientListQuerySchema,
  recipientQuerySchema,
  restoreBodySchema,
  unsubscribeBodySchema,
  webhookChannelBodySchema,
} from '@/server/modules/notifications/http/notification-schemas'
import {
  apiErrorSchema,
  apiKeySchema,
  appChannelSchema,
  appChannelSettingSchema,
  appDetailSchema,
  appSchema,
  archivedSchema,
  channelStatusSchema,
  contactClearedSchema,
  contactSetSchema,
  createdApiKeySchema,
  deletedSchema,
  deliveryPageSchema,
  envelope,
  fleetStatsSchema,
  healthReportSchema,
  inboxPageSchema,
  liveReportSchema,
  preferenceSetSchema,
  publishResultSchema,
  pushRemovedSchema,
  pushSubscribedSchema,
  readSchema,
  recipientPageSchema,
  recipientSummarySchema,
  recipientTokenSchema,
  restoredSchema,
  unsubscribedSchema,
  webhookChannelSchema,
  webhookConfiguredSchema,
  webhookSecretSchema,
  webpushKeySchema,
} from '@/server/openapi/response-schemas'

// The business API spec. Request schemas are the ones the routes validate with, so the document cannot
// drift from the implementation. Routes are listed once here; the coverage test checks every
// src/routes/api.v1.* file has an entry.

const registry = new OpenAPIRegistry()

const json = (schema: z.ZodType) => ({ 'application/json': { schema } })

// Every success body is `{ data }`, so a payload is wrapped here once.
const reply = <T extends z.ZodType>(payload: T, status: number = HttpStatus.OK.code) => ({
  [status]: { description: 'Success', content: json(envelope(payload)) },
})

const failure = { default: { description: 'Failure, see ApiError', content: json(apiErrorSchema) } }

const appParams = z.object({ appKey: z.string().describe('The app key the request is scoped to.') })
const recipientParams = appParams.extend({
  recipientKey: z.string().describe('The recipient key the app sends for its user.'),
})
const notificationParams = appParams.extend({ id: z.uuid().describe('The notification id.') })
const deliveryParams = z.object({ id: z.uuid().describe('The delivery id.') })

const serviceKey = { serviceKey: [] }
const recipientToken = { recipientToken: [] }
const session = { sessionCookie: [] }

// Either credential may call the route; the handler decides which permission applies.
const consumerAuth = [recipientToken, serviceKey]
const serviceOnly = [serviceKey]
const sessionOnly = [session]
const appAdmin = [session, serviceKey]
const noAuth: Array<Record<string, string[]>> = []

registry.registerComponent('securitySchemes', 'serviceKey', {
  type: 'http',
  scheme: 'bearer',
  description:
    'Service API key (`lnk_…`), sent as `Authorization: Bearer lnk_…` or in the `x-api-key` header. Each operation names the permission it needs.',
})

registry.registerComponent('securitySchemes', 'recipientToken', {
  type: 'http',
  scheme: 'bearer',
  description:
    'Recipient token (`lrt_…`), minted by `POST …/recipients/{recipientKey}/token`. It lasts 15 minutes and reads one recipient only. EventSource and WebSocket clients pass it as `?token=`.',
})

registry.registerComponent('securitySchemes', 'sessionCookie', {
  type: 'apiKey',
  in: 'cookie',
  name: 'better-auth.session_token',
  description:
    'Better Auth session cookie for the dashboard. Under HTTPS the cookie is prefixed with `__Secure-`, so the browser sends `__Secure-better-auth.session_token`.',
})

type Route = {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete'
  path: string
  tags: string[]
  summary: string
  description: string
  security: Array<Record<string, string[]>>
  params?: z.ZodObject
  query?: z.ZodObject
  body?: z.ZodType
  responses: Record<string | number, unknown>
}

function route({ body, query, params, responses, ...rest }: Route) {
  registry.registerPath({
    ...rest,
    request: {
      ...(params ? { params } : {}),
      ...(query ? { query } : {}),
      ...(body ? { body: { content: json(body), required: true } } : {}),
    },
    responses: { ...responses, ...failure },
  })
}

// Consumer: notifications and inbox

route({
  method: 'post',
  path: '/api/v1/apps/{appKey}/notifications',
  tags: ['notifications'],
  summary: 'Publish a notification',
  description:
    'Writes the notification and its per-channel deliveries in one transaction. Answers Accepted, not delivered yet. `duplicate` is true when a `dedupeKey` already exists for the recipient.',
  security: serviceOnly,
  params: appParams,
  body: publishBodySchema,
  responses: reply(publishResultSchema, HttpStatus.ACCEPTED.code),
})

route({
  method: 'delete',
  path: '/api/v1/apps/{appKey}/notifications/{id}',
  tags: ['inbox'],
  summary: 'Delete one notification',
  description: 'A key caller names the recipient with `?recipient=`; a recipient token is pinned to its own rows.',
  security: consumerAuth,
  params: notificationParams,
  query: recipientQuerySchema,
  responses: reply(deletedSchema),
})

route({
  method: 'get',
  path: '/api/v1/apps/{appKey}/inbox',
  tags: ['inbox'],
  summary: 'List the inbox',
  description:
    'In-app rows only. Ascending keyset pages use `since`; `order=desc` returns the newest page, with `latest` as the stream resume cursor. `before` pages back. `view=archived` lists archived rows still inside the 30-day retention window. `unread` is the badge count.',
  security: consumerAuth,
  params: appParams,
  query: inboxQuerySchema,
  responses: reply(inboxPageSchema),
})

route({
  method: 'post',
  path: '/api/v1/apps/{appKey}/inbox/read',
  tags: ['inbox'],
  summary: 'Mark notifications read',
  description: 'Send `{ ids }` or `{ all: true }`.',
  security: consumerAuth,
  params: appParams,
  body: inboxReadBodySchema,
  responses: reply(readSchema),
})

route({
  method: 'post',
  path: '/api/v1/apps/{appKey}/inbox/archive',
  tags: ['inbox'],
  summary: 'Archive notifications',
  description: 'Send `{ ids }` or `{ read: true }` to archive every read row. Archiving also marks the rows read.',
  security: consumerAuth,
  params: appParams,
  body: archiveBodySchema,
  responses: reply(archivedSchema),
})

route({
  method: 'post',
  path: '/api/v1/apps/{appKey}/inbox/restore',
  tags: ['inbox'],
  summary: 'Restore archived notifications',
  description: 'Moves archived rows back to the inbox.',
  security: consumerAuth,
  params: appParams,
  body: restoreBodySchema,
  responses: reply(restoredSchema),
})

route({
  method: 'get',
  path: '/api/v1/apps/{appKey}/stream',
  tags: ['realtime'],
  summary: 'Live inbox stream (SSE)',
  description:
    'Long-lived `text/event-stream`. Each frame is `event: notification` with `id:` set to the inbox cursor and `data:` set to one `Notification` object, the same item the inbox returns. Resume with `Last-Event-ID` or `?lastEventId=`. A token-backed stream ends when its token expires. The WebSocket gateway on `WS_PORT` (default 3001) carries the same frames as `{ type: "notification", cursor, notification }` and is not part of this document.',
  security: consumerAuth,
  params: appParams,
  query: z.strictObject({
    token: z.string().optional().describe('Recipient token, for clients that cannot set headers.'),
    lastEventId: z.string().optional().describe('Resume cursor, for clients that cannot set Last-Event-ID.'),
  }),
  responses: {
    [HttpStatus.OK.code]: {
      description: 'Stream of notification frames',
      content: { 'text/event-stream': { schema: z.string() } },
    },
  },
})

// Consumer: push, Web Push key and unsubscribe

route({
  method: 'post',
  path: '/api/v1/apps/{appKey}/push-subscriptions',
  tags: ['push'],
  summary: 'Register a browser push subscription',
  description: 'Stores the Web Push endpoint and keys for one recipient.',
  security: consumerAuth,
  params: appParams,
  body: pushSubscriptionBodySchema,
  responses: reply(pushSubscribedSchema),
})

route({
  method: 'delete',
  path: '/api/v1/apps/{appKey}/push-subscriptions',
  tags: ['push'],
  summary: 'Remove a browser push subscription',
  description: 'Removes one endpoint. `removed` is false when it was not registered.',
  security: consumerAuth,
  params: appParams,
  body: pushUnsubscribeBodySchema,
  responses: reply(pushRemovedSchema),
})

route({
  method: 'get',
  path: '/api/v1/apps/{appKey}/webpush-public-key',
  tags: ['push'],
  summary: 'Read the VAPID public key',
  description:
    'The key is public by design; a recipient credential is still required so the endpoint cannot be probed anonymously.',
  security: consumerAuth,
  params: appParams,
  responses: reply(webpushKeySchema),
})

route({
  method: 'post',
  path: '/api/v1/unsubscribe',
  tags: ['unsubscribe'],
  summary: 'One-click unsubscribe (RFC 8058)',
  description:
    'Turns email off for one recipient. The signed HMAC token is the proof, so there is no session or API key. Mail clients post the link from the `List-Unsubscribe` header with the parameters in the query string. A browser form submit gets the confirmation page instead of JSON.',
  security: noAuth,
  query: unsubscribeBodySchema,
  body: unsubscribeBodySchema,
  responses: reply(unsubscribedSchema),
})

route({
  method: 'get',
  path: '/api/v1/unsubscribe',
  tags: ['unsubscribe'],
  summary: 'Confirm an unsubscribe link',
  description: 'Shows what the link would do and changes nothing, so link previews and mail scanners are safe.',
  security: noAuth,
  query: unsubscribeBodySchema,
  responses: {
    [HttpStatus.OK.code]: { description: 'Confirmation page', content: { 'text/html': { schema: z.string() } } },
  },
})

// Consumer: recipients, contacts and preferences

route({
  method: 'get',
  path: '/api/v1/apps/{appKey}/recipients',
  tags: ['recipients'],
  summary: 'List recipient keys',
  description: 'Keyset page of every recipient key the app has. `next` is the cursor for the next page.',
  security: serviceOnly,
  params: appParams,
  query: recipientListQuerySchema,
  responses: reply(recipientPageSchema),
})

route({
  method: 'get',
  path: '/api/v1/apps/{appKey}/recipients/{recipientKey}',
  tags: ['recipients'],
  summary: 'Read one recipient',
  description: 'Masked email and webhook origin, push subscription count and preferences. No raw addresses.',
  security: serviceOnly,
  params: recipientParams,
  responses: reply(recipientSummarySchema),
})

route({
  method: 'put',
  path: '/api/v1/apps/{appKey}/recipients/{recipientKey}/contact',
  tags: ['recipients'],
  summary: 'Set a contact address',
  description:
    'Only an app key with `recipients:update` may set a contact address; a recipient token cannot. A webhook URL must be `https` and public, because the stored URL decides where the server posts.',
  security: consumerAuth,
  params: recipientParams,
  body: contactBodySchema,
  responses: reply(contactSetSchema),
})

route({
  method: 'delete',
  path: '/api/v1/apps/{appKey}/recipients/{recipientKey}/contact',
  tags: ['recipients'],
  summary: 'Clear one contact channel',
  description: 'Idempotent. Clearing an empty channel reports `cleared: false`.',
  security: serviceOnly,
  params: recipientParams,
  query: contactClearQuerySchema,
  responses: reply(contactClearedSchema),
})

route({
  method: 'put',
  path: '/api/v1/apps/{appKey}/recipients/{recipientKey}/preferences',
  tags: ['recipients'],
  summary: 'Opt a channel in or out',
  description: 'Sets `enabled` for one channel. Turning email off is how the unsubscribe link works.',
  security: consumerAuth,
  params: recipientParams,
  body: preferencesBodySchema,
  responses: reply(preferenceSetSchema),
})

route({
  method: 'post',
  path: '/api/v1/apps/{appKey}/recipients/{recipientKey}/token',
  tags: ['recipients'],
  summary: 'Mint a recipient token',
  description:
    'Needs `tokens:create`. Returns a 15-minute read-only `lrt_…` token for one recipient, shown once. The app key never reaches the browser.',
  security: serviceOnly,
  params: recipientParams,
  responses: reply(recipientTokenSchema),
})

// Consumer: webhook channel (per app)

route({
  method: 'get',
  path: '/api/v1/apps/{appKey}/channels',
  tags: ['channels'],
  summary: 'Read the webhook channel',
  description: 'Needs `channels:read`. Reports whether a secret is set, never the secret.',
  security: serviceOnly,
  params: appParams,
  responses: reply(z.strictObject({ channels: z.array(webhookChannelSchema) })),
})

route({
  method: 'put',
  path: '/api/v1/apps/{appKey}/channels/webhook',
  tags: ['channels'],
  summary: 'Set the webhook endpoint',
  description:
    'Needs `channels:update`. The first call also issues the signing secret, returned once in `secret`. Later calls are idempotent and omit it. `endpointUrl: null` clears the endpoint.',
  security: serviceOnly,
  params: appParams,
  body: webhookChannelBodySchema,
  responses: reply(webhookConfiguredSchema),
})

route({
  method: 'post',
  path: '/api/v1/apps/{appKey}/channels/webhook/secret',
  tags: ['channels'],
  summary: 'Rotate the webhook signing secret',
  description:
    'Needs `channels:update`. The new secret is returned once. The old one stops signing at once, so redeploy the receiver first.',
  security: serviceOnly,
  params: appParams,
  responses: reply(webhookSecretSchema),
})

// Admin: API keys (dashboard session only)

route({
  method: 'get',
  path: '/api/v1/admin/api-keys',
  tags: ['admin'],
  summary: 'List API keys',
  description: 'The signed-in user’s keys. Instance admins also see everyone’s. Secrets are never listed.',
  security: sessionOnly,
  responses: reply(z.strictObject({ keys: z.array(apiKeySchema) })),
})

route({
  method: 'post',
  path: '/api/v1/admin/api-keys',
  tags: ['admin'],
  summary: 'Create an API key',
  description:
    'Same-origin only. An app-bound key needs that app’s admin; an instance key needs the instance admin. The key is in this response once.',
  security: sessionOnly,
  body: keyCreateSchema,
  responses: reply(createdApiKeySchema, HttpStatus.CREATED.code),
})

route({
  method: 'patch',
  path: '/api/v1/admin/api-keys',
  tags: ['admin'],
  summary: 'Change a key’s scopes or enabled flag',
  description: 'Same-origin only. Send `scopes`, `enabled`, or both.',
  security: sessionOnly,
  body: keyUpdateSchema,
  responses: reply(z.strictObject({ updated: z.literal(true) })),
})

route({
  method: 'delete',
  path: '/api/v1/admin/api-keys',
  tags: ['admin'],
  summary: 'Delete an API key',
  description: 'Same-origin only. Passed as `?keyId=` and optional `?appKey=`.',
  security: sessionOnly,
  query: keyDeleteQuerySchema,
  responses: reply(deletedSchema),
})

// Admin: apps, channels, stats and deliveries

route({
  method: 'get',
  path: '/api/v1/admin/apps',
  tags: ['admin'],
  summary: 'List apps',
  description: 'Session callers see the apps they administer. An unbound key with `apps:read` sees all of them.',
  security: appAdmin,
  responses: reply(z.strictObject({ apps: z.array(appSchema) })),
})

route({
  method: 'post',
  path: '/api/v1/admin/apps',
  tags: ['admin'],
  summary: 'Create an app',
  description: 'Instance admins only, or an unbound key with `apps:create`. Same-origin for sessions.',
  security: appAdmin,
  body: appCreateSchema,
  responses: reply(appSchema, HttpStatus.CREATED.code),
})

route({
  method: 'patch',
  path: '/api/v1/admin/apps/{appKey}',
  tags: ['admin'],
  summary: 'Update an app',
  description: 'Changes its name or registered origin. Same-origin for sessions.',
  security: appAdmin,
  params: appParams,
  body: appUpdateSchema,
  responses: reply(appSchema),
})

route({
  method: 'delete',
  path: '/api/v1/admin/apps/{appKey}',
  tags: ['admin'],
  summary: 'Delete an app',
  description: 'Instance admins, or an unbound key with `apps:delete`. Same-origin for sessions.',
  security: appAdmin,
  params: appParams,
  responses: reply(deletedSchema),
})

route({
  method: 'get',
  path: '/api/v1/admin/apps/{appKey}/channels',
  tags: ['admin'],
  summary: 'Read an app’s delivery channels',
  description: 'Every installed channel with its switch and non-secret config. Never a secret.',
  security: appAdmin,
  params: appParams,
  responses: reply(z.strictObject({ channels: z.array(appChannelSchema) })),
})

route({
  method: 'patch',
  path: '/api/v1/admin/apps/{appKey}/channels',
  tags: ['admin'],
  summary: 'Switch or configure a channel',
  description: 'Turns a channel on or off for the app, or saves its config. The webhook URL is checked on save.',
  security: appAdmin,
  params: appParams,
  body: channelPatchSchema,
  responses: reply(appChannelSettingSchema),
})

route({
  method: 'get',
  path: '/api/v1/admin/apps/{appKey}/stats',
  tags: ['admin'],
  summary: 'Read one app’s stats',
  description: 'Totals, daily series, channel breakdown and top types and recipients over `days`.',
  security: sessionOnly,
  params: appParams,
  query: statsQuerySchema,
  responses: reply(z.strictObject({ detail: appDetailSchema })),
})

route({
  method: 'get',
  path: '/api/v1/admin/stats',
  tags: ['admin'],
  summary: 'Read fleet stats',
  description: 'The same numbers across every app the caller administers, plus the top apps.',
  security: sessionOnly,
  query: statsQuerySchema,
  responses: reply(z.strictObject({ stats: fleetStatsSchema })),
})

route({
  method: 'get',
  path: '/api/v1/admin/channel-status',
  tags: ['admin'],
  summary: 'Read installed channel plugins',
  description: 'Each channel plugin’s enabled state, detail and non-secret facts.',
  security: sessionOnly,
  responses: reply(z.strictObject({ channels: z.array(channelStatusSchema) })),
})

route({
  method: 'get',
  path: '/api/v1/admin/deliveries',
  tags: ['admin'],
  summary: 'List deliveries',
  description: 'Read-only and role-scoped. Each row carries its failure code and attempt count.',
  security: sessionOnly,
  query: deliveriesQuerySchema,
  responses: reply(deliveryPageSchema),
})

route({
  method: 'post',
  path: '/api/v1/admin/deliveries/{id}/retry',
  tags: ['admin'],
  summary: 'Retry a dead-letter delivery',
  description: 'Only a dead-letter delivery can be requeued. Same-origin for sessions.',
  security: sessionOnly,
  params: deliveryParams,
  responses: reply(z.strictObject({ retried: z.literal(true) })),
})

// Health probes (unauthenticated)

route({
  method: 'get',
  path: '/api/live',
  tags: ['health'],
  summary: 'Liveness probe',
  description: 'Answers while the process is alive. It never touches the database.',
  security: noAuth,
  responses: reply(liveReportSchema),
})

route({
  method: 'get',
  path: '/api/ready',
  tags: ['health'],
  summary: 'Readiness probe',
  description:
    'Probes the database. Answers the service-unavailable status with the same report when the database is degraded.',
  security: noAuth,
  responses: {
    ...reply(healthReportSchema),
    ...reply(healthReportSchema, HttpStatus.SERVICE_UNAVAILABLE.code),
  },
})

export function buildOpenApiDocument(serverUrl: string) {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      version: '1.0.0',
      title: 'Last Notifications API',
      description:
        'The publish, inbox, recipient and channel API of a Last Notifications server. Successful responses are wrapped in `{ "data": ... }`; failures answer `{ "error": { "code": "...", "message": "..." } }`. The authentication endpoints are documented separately on the auth reference page at `/api/auth/reference`.',
    },
    servers: [{ url: serverUrl }],
  })
}
