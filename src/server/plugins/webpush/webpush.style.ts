import { z } from 'zod'

// The per-channel presentation contract. `data.webpush` carries these keys; the
// schema drops anything else, so an app cannot smuggle arbitrary fields into the
// push payload.
const styleSchema = z.strictObject({
  icon: z.url().max(2048).optional(),
  badge: z.url().max(2048).optional(),
  image: z.url().max(2048).optional(),
  actions: z
    .array(
      z.strictObject({
        action: z.string().min(1).max(64),
        title: z.string().min(1).max(120),
        url: z.url().max(2048).optional(),
      }),
    )
    .max(2)
    .optional(),
})

export type WebpushStyle = z.infer<typeof styleSchema>

export function parseWebpushStyle(data: Record<string, unknown>): WebpushStyle {
  const parsed = styleSchema.safeParse(data.webpush)
  return parsed.success ? parsed.data : {}
}
