import { z } from 'zod'

import { API_KEY_SCOPES } from '@/lib/api-key-scopes'
import { NOTIFICATION_CHANNELS } from '@/server/db/vocabularies'

export const appKeySchema = z.string().trim().min(1).max(200)
export const keyIdSchema = z.string().min(1).max(255)
export const deliveryIdSchema = z.uuid()

export const appCreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  origin: z.url().max(2048),
})

export const appUpdateSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120).optional(),
    origin: z.url().max(2048).optional(),
  })
  .refine((body) => body.name !== undefined || body.origin !== undefined, {
    message: 'Provide a name or an origin',
  })

const scopeSchema = z.enum(API_KEY_SCOPES)

export const keyCreateSchema = z.strictObject({
  appKey: appKeySchema.optional(),
  name: z.string().trim().min(1).max(120),
  scopes: z.array(scopeSchema).min(1).max(API_KEY_SCOPES.length),
  // Seconds until the key expires; omitted means it never does.
  expiresIn: z.number().int().positive().optional(),
  // Requests allowed per window for this key. Omitted uses the server default.
  rateLimit: z
    .strictObject({
      windowMs: z.number().int().min(1_000).max(86_400_000),
      max: z.number().int().min(1).max(1_000_000),
    })
    .optional(),
})

export const keyUpdateSchema = z
  .strictObject({
    keyId: keyIdSchema,
    appKey: appKeySchema.optional(),
    scopes: z.array(scopeSchema).min(1).max(API_KEY_SCOPES.length).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((body) => body.scopes !== undefined || body.enabled !== undefined, {
    message: 'Provide scopes or enabled',
  })

export const keyDeleteQuerySchema = z.strictObject({
  keyId: keyIdSchema,
  appKey: appKeySchema.optional(),
})

export const channelPatchSchema = z.strictObject({
  channel: z.enum(NOTIFICATION_CHANNELS),
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

export const deliveriesQuerySchema = z.strictObject({
  appKey: appKeySchema.optional(),
  channel: z.enum(NOTIFICATION_CHANNELS).optional(),
  status: z.enum(['pending', 'processing', 'delivered', 'dead_letter']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

const STATS_RANGE = { '7': 7, '30': 30, '90': 90, all: 'all' } as const

export const statsQuerySchema = z.strictObject({
  days: z
    .enum(['7', '30', '90', 'all'])
    .default('30')
    .transform((days) => STATS_RANGE[days]),
})
