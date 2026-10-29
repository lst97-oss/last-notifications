import { z } from 'zod'

import { CONTACT_CHANNELS, NOTIFICATION_CHANNELS } from '@/server/db/vocabularies'

// Response schemas for the OpenAPI document. Request schemas are the ones the routes validate with
// (imported in registry.ts); these describe what the handlers return. Named schemas carry a
// `.meta({ id })` so they land in components.schemas as $refs.

const timestamp = z.iso.datetime()
const nullableTimestamp = timestamp.nullable()
const channelKind = z.enum(NOTIFICATION_CHANNELS)
const contactChannel = z.enum(CONTACT_CHANNELS)
const deliveryStatus = z.enum(['pending', 'processing', 'delivered', 'dead_letter'])

// Successful bodies are `{ data }`; failures are `{ error }` (see src/server/http/response.ts).
export const envelope = <T extends z.ZodType>(payload: T) => z.strictObject({ data: payload })

export const apiErrorSchema = z
  .strictObject({ error: z.strictObject({ code: z.string(), message: z.string() }) })
  .meta({ id: 'ApiError' })

// Consumer: notifications and inbox

export const notificationSchema = z
  .strictObject({
    id: z.uuid(),
    type: z.string(),
    title: z.string(),
    body: z.string(),
    data: z.record(z.string(), z.unknown()),
    priority: z.number().int(),
    readAt: nullableTimestamp,
    archivedAt: nullableTimestamp,
    createdAt: timestamp,
  })
  .meta({ id: 'Notification' })

// What a recipient sees. Internal ids (appId, recipientKey, dedupeKey) are never part of it.
export type InboxItem = z.infer<typeof notificationSchema>

export const publishResultSchema = z
  .strictObject({ id: z.uuid(), duplicate: z.boolean(), channels: z.array(channelKind) })
  .meta({ id: 'PublishResult' })

export const inboxPageSchema = z
  .strictObject({
    items: z.array(notificationSchema),
    next: z.string().nullable(),
    total: z.number().int(),
    unread: z.number().int(),
    // Resume cursor for the live stream; set only on a newest-first first page.
    latest: z.string().nullable(),
  })
  .meta({ id: 'InboxPage' })

export const archivedSchema = z.strictObject({ archived: z.number().int() }).meta({ id: 'ArchivedCount' })
export const restoredSchema = z.strictObject({ restored: z.number().int() }).meta({ id: 'RestoredCount' })
export const readSchema = z.strictObject({ updated: z.number().int() }).meta({ id: 'ReadCount' })
export const deletedSchema = z.strictObject({ deleted: z.literal(true) }).meta({ id: 'Deleted' })

export const recipientTokenSchema = z
  .strictObject({ token: z.string(), expiresAt: timestamp })
  .meta({ id: 'RecipientToken' })

// Consumer: recipients, contacts and preferences

const recipientAddress = z.strictObject({ set: z.boolean(), masked: z.string().nullable() })

export const recipientSummarySchema = z
  .strictObject({
    recipientKey: z.string(),
    email: recipientAddress,
    webhook: recipientAddress,
    push: z.strictObject({ subscriptions: z.number().int() }),
    preferences: z.record(z.string(), z.boolean()),
  })
  .meta({ id: 'RecipientSummary' })

export const recipientPageSchema = z
  .strictObject({ recipients: z.array(z.string()), next: z.string().nullable() })
  .meta({ id: 'RecipientPage' })

export const contactSetSchema = z
  .strictObject({ channel: contactChannel, address: z.string() })
  .meta({ id: 'ContactSet' })

export const contactClearedSchema = z
  .strictObject({ channel: contactChannel, cleared: z.boolean() })
  .meta({ id: 'ContactCleared' })

export const preferenceSetSchema = z
  .strictObject({ channel: channelKind, enabled: z.boolean() })
  .meta({ id: 'PreferenceSet' })

// Consumer: push, Web Push key and unsubscribe

export const pushSubscribedSchema = z.strictObject({ subscribed: z.literal(true) }).meta({ id: 'PushSubscribed' })
export const pushRemovedSchema = z.strictObject({ removed: z.boolean() }).meta({ id: 'PushRemoved' })
export const webpushKeySchema = z.strictObject({ publicKey: z.string() }).meta({ id: 'WebPushKey' })
export const unsubscribedSchema = z.strictObject({ unsubscribed: z.literal(true) }).meta({ id: 'Unsubscribed' })

// Consumer: webhook channel (per app)

export const webhookChannelSchema = z
  .strictObject({
    channel: z.literal('webhook'),
    enabled: z.boolean(),
    endpointUrl: z.string().nullable(),
    secretConfigured: z.boolean(),
  })
  .meta({ id: 'WebhookChannel' })

// The signing secret is present only on the call that issues it.
export const webhookConfiguredSchema = z
  .strictObject({
    channel: z.literal('webhook'),
    endpointUrl: z.string().nullable(),
    secretConfigured: z.literal(true),
    secret: z.string().optional(),
  })
  .meta({ id: 'WebhookConfigured' })

export const webhookSecretSchema = z
  .strictObject({ channel: z.literal('webhook'), secretConfigured: z.literal(true), secret: z.string() })
  .meta({ id: 'WebhookSecret' })

// Admin: API keys, apps, channels, stats and deliveries (dashboard and instance keys)

export const apiKeySchema = z
  .strictObject({
    id: z.string(),
    name: z.string().nullable(),
    start: z.string().nullable(),
    prefix: z.string().nullable(),
    enabled: z.boolean(),
    expiresAt: nullableTimestamp,
    lastRequest: nullableTimestamp,
    createdAt: timestamp,
    metadata: z.strictObject({ app: z.string() }).nullable(),
    permissions: z.record(z.string(), z.array(z.string())).nullable(),
  })
  .meta({ id: 'ApiKey' })

// The raw key is returned once, here, and never again.
export const createdApiKeySchema = z
  .strictObject({ id: z.string(), key: z.string(), name: z.string(), appKey: z.string().nullable() })
  .meta({ id: 'CreatedApiKey' })

export const appSchema = z
  .strictObject({ id: z.string(), key: z.string(), name: z.string(), createdAt: timestamp })
  .meta({ id: 'App' })

export const channelFactSchema = z.strictObject({ label: z.string(), value: z.string() }).meta({ id: 'ChannelFact' })

export const channelStatusSchema = z
  .strictObject({
    id: z.string(),
    apiVersion: z.literal(1),
    enabled: z.boolean(),
    detail: z.string(),
    facts: z.array(channelFactSchema),
    channels: z.array(channelKind),
  })
  .meta({ id: 'ChannelStatus' })

export const appChannelSchema = z
  .strictObject({
    channel: channelKind,
    installed: z.boolean(),
    detail: z.string(),
    enabled: z.boolean(),
    config: z.record(z.string(), z.unknown()),
    facts: z.array(channelFactSchema),
  })
  .meta({ id: 'AppChannel' })

export const appChannelSettingSchema = z.strictObject({
  channel: channelKind,
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()),
})

export const deliverySchema = z
  .strictObject({
    id: z.uuid(),
    channel: channelKind,
    status: deliveryStatus,
    attempts: z.number().int(),
    lastError: z.string().nullable(),
    deliveredAt: nullableTimestamp,
    notificationId: z.uuid(),
    title: z.string(),
    recipientKey: z.string(),
    appKey: z.string(),
    createdAt: timestamp,
  })
  .meta({ id: 'Delivery' })

export const deliveryPageSchema = z
  .strictObject({
    deliveries: z.array(deliverySchema),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })
  .meta({ id: 'DeliveryPage' })

const statsTotals = z.strictObject({
  published: z.number().int(),
  read: z.number().int(),
  recipients: z.number().int(),
  delivered: z.number().int(),
  deadLetter: z.number().int(),
  pending: z.number().int(),
  processing: z.number().int(),
})

const statsWindow = z.strictObject({
  days: z.number().int(),
  start: z.string(),
  published: z.number().int(),
  delivered: z.number().int(),
  deadLetter: z.number().int(),
})

const statsSeries = z.strictObject({
  day: z.string(),
  published: z.number().int(),
  read: z.number().int(),
  delivered: z.number().int(),
  deadLetter: z.number().int(),
  pending: z.number().int(),
})

const appStats = z.strictObject({
  totals: statsTotals,
  window: statsWindow,
  series: z.array(statsSeries),
  byChannel: z.array(
    z.strictObject({ channel: z.string(), delivered: z.number().int(), deadLetter: z.number().int() }),
  ),
  topTypes: z.array(z.strictObject({ type: z.string(), total: z.number().int() })),
  topRecipients: z.array(z.strictObject({ recipientKey: z.string(), total: z.number().int() })),
})

export const appDetailSchema = z
  .strictObject({
    app: z.strictObject({
      id: z.string(),
      key: z.string(),
      name: z.string(),
      origin: z.string().nullable(),
      createdAt: timestamp,
    }),
    stats: appStats,
  })
  .meta({ id: 'AppDetail' })

export const fleetStatsSchema = appStats
  .extend({
    topApps: z.array(z.strictObject({ appKey: z.string(), appName: z.string(), total: z.number().int() })),
  })
  .meta({ id: 'FleetStats' })

// Health probes (unauthenticated, outside the envelope's error path)

export const liveReportSchema = z
  .strictObject({ status: z.literal('live'), timestamp, uptimeSeconds: z.number().int() })
  .meta({ id: 'LiveReport' })

export const healthReportSchema = z
  .strictObject({
    status: z.enum(['ok', 'degraded']),
    timestamp,
    uptimeSeconds: z.number().int(),
    checks: z.strictObject({ database: z.strictObject({ ok: z.boolean(), latencyMs: z.number() }) }),
  })
  .meta({ id: 'HealthReport' })
