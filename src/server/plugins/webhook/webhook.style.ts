import { z } from 'zod'

// The optional event name a receiver sees in x-last-notifications-event. Header-safe by construction.
const EVENT_NAME = /^[a-z][a-z0-9._-]{0,63}$/

const webhookStyleSchema = z.strictObject({ event: z.string().regex(EVENT_NAME).optional() })

export function parseWebhookStyle(data: Record<string, unknown>): { event?: string } {
  const parsed = webhookStyleSchema.safeParse(data.webhook ?? {})
  return parsed.success ? parsed.data : {}
}
