import { z } from 'zod'

import { CONTACT_CHANNELS, NOTIFICATION_CHANNELS } from '@/server/db/vocabularies'
import { WEBHOOK_URL_MAX_LENGTH } from '@/server/modules/notifications/domain/webhook-url'

const recipientKeySchema = z
  .string()
  .trim()
  .min(1, 'Enter a recipient key')
  .max(200, 'Recipient key must be at most 200 characters')

export const appKeyParamSchema = z.string().trim().min(1).max(200)
export const recipientKeyParamSchema = recipientKeySchema
export const notificationIdParamSchema = z.uuid('Enter a valid notification id')
// Key callers name the recipient whose notification they act on; a recipient token needs no query.
export const recipientQuerySchema = z.strictObject({ recipient: recipientKeySchema.optional() })
export const recipientListQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  // Opaque: the base64url of the last recipient key on the previous page.
  cursor: z.string().min(1).max(500).optional(),
})
export const contactClearQuerySchema = z.strictObject({ channel: z.enum(CONTACT_CHANNELS) })

const channelSchema = z.enum(NOTIFICATION_CHANNELS)

// A publish carries a message and its data: the body cap is larger than the default, and the
// data is capped on its own because it is copied into every inbox page and stream frame.
export const PUBLISH_BODY_MAX_BYTES = 128 * 1024
const DATA_MAX_JSON_CHARS = 16 * 1024

export const publishBodySchema = z.strictObject({
  recipientKey: recipientKeySchema,
  type: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(300),
  body: z.string().max(20_000).default(''),
  data: z
    .record(z.string(), z.unknown())
    .refine((data) => JSON.stringify(data).length <= DATA_MAX_JSON_CHARS, {
      message: `must be at most ${DATA_MAX_JSON_CHARS} characters as JSON`,
    })
    .default({}),
  priority: z.number().int().min(-2).max(2).default(0),
  channels: z.array(channelSchema).min(1).optional(),
  dedupeKey: z.string().trim().min(1).max(200).optional(),
  email: z.email().optional(),
})

export const inboxQuerySchema = z
  .strictObject({
    since: z.string().min(1).max(500).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    recipient: recipientKeySchema.optional(),
    // EventSource and WebSocket cannot set headers; REST accepts the same form for parity.
    token: z.string().min(1).max(500).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    // `archived` lists archived rows still inside the 30-day retention window.
    view: z.enum(['active', 'archived']).optional(),
    // Older-page cursor for newest-first paging; the bell's lazy loading reads the next page with it.
    before: z.string().min(1).max(500).optional(),
  })
  .refine((query) => !(query.order === 'desc' && query.since), {
    message: 'Newest-first pages have no cursor; drop since or order',
  })
  .refine((query) => !query.before || (query.order === 'desc' && !query.since), {
    message: 'before needs order=desc and no since',
  })

export const archiveBodySchema = z
  .strictObject({
    ids: z.array(z.string().uuid()).min(1).max(200).optional(),
    read: z.literal(true).optional(),
    recipientKey: recipientKeySchema.optional(),
  })
  .refine((body) => Boolean(body.read) !== Boolean(body.ids?.length), {
    message: 'Provide either ids or read',
  })

export const restoreBodySchema = z.strictObject({
  ids: z.array(z.string().uuid()).min(1).max(200),
  recipientKey: recipientKeySchema.optional(),
})

export const inboxReadBodySchema = z
  .strictObject({
    ids: z.array(z.string().uuid()).min(1).max(200).optional(),
    all: z.literal(true).optional(),
    recipientKey: recipientKeySchema.optional(),
  })
  .refine((body) => Boolean(body.all) !== Boolean(body.ids?.length), {
    message: 'Provide either ids or all',
  })

// Email keeps its original shape ({address}); a webhook contact names its channel. The webhook URL's
// shape and private-network rules are checked in the handler, where the plugin settings are read.
export const contactBodySchema = z
  .strictObject({
    channel: z.enum(CONTACT_CHANNELS).default('email'),
    address: z.string().trim().min(1).max(WEBHOOK_URL_MAX_LENGTH),
  })
  .superRefine((body, ctx) => {
    if (body.channel === 'email' && !z.email().safeParse(body.address).success) {
      ctx.addIssue({ code: 'custom', path: ['address'], message: 'must be a valid email address' })
    }
  })

export const preferencesBodySchema = z.strictObject({
  channel: channelSchema,
  enabled: z.boolean(),
})

export const pushSubscriptionBodySchema = z.strictObject({
  recipientKey: recipientKeySchema.optional(),
  endpoint: z.url().max(2048),
  keys: z.strictObject({ p256dh: z.string().min(1), auth: z.string().min(1) }),
})

export const pushUnsubscribeBodySchema = z.strictObject({
  recipientKey: recipientKeySchema.optional(),
  endpoint: z.url().max(2048),
})

// The app's webhook endpoint; null clears it. The URL rules (https, public host) run in the handler,
// because they depend on the server's private-network setting.
export const webhookChannelBodySchema = z.strictObject({
  endpointUrl: z.string().trim().min(1).max(WEBHOOK_URL_MAX_LENGTH).nullable(),
})

export const unsubscribeBodySchema = z.strictObject({
  appKey: z.string().trim().min(1).max(200),
  recipientKey: recipientKeySchema,
  email: z.email(),
  token: z.string().min(16).max(200),
})
