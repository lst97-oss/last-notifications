import { z } from 'zod'

import { definePluginConfig } from '@/server/plugins/plugin-config'

// Non-secret tuning lives in the TS file; the VAPID key pair and subject come from
// the environment only, so no secret ever lands in a config value.
const fileSchema = z.strictObject({
  ttlSeconds: z.number().int().min(0).max(2_419_200).default(86_400),
  urgency: z.enum(['very-low', 'low', 'normal', 'high']).default('normal'),
})

export const webpushConfigDef = definePluginConfig({
  id: 'webpush',
  fileSchema,
  defaults: { ttlSeconds: 86_400, urgency: 'normal' as const },
  resolve: (file, env) => {
    const publicKey = env.VAPID_PUBLIC_KEY?.trim()
    const privateKey = env.VAPID_PRIVATE_KEY?.trim()
    const subject = env.VAPID_SUBJECT?.trim()
    const configured = Boolean(publicKey && privateKey && subject)
    return {
      configured,
      publicKey: publicKey ?? null,
      privateKey: privateKey ?? null,
      subject: subject ?? null,
      ttlSeconds: file.ttlSeconds,
      urgency: file.urgency,
    }
  },
})

export type WebpushConfig = ReturnType<typeof webpushConfigDef.resolve>

export function getWebpushConfig(source?: Record<string, string | undefined>): WebpushConfig {
  const env = source ?? (typeof Bun !== 'undefined' ? (Bun.env as Record<string, string | undefined>) : process.env)
  return webpushConfigDef.resolve(fileSchema.parse(webpushConfigDef.defaults), env)
}

// Stale-subscription hygiene: a push endpoint that answered 404/410 is dead now;
// one that has not been used in 60 days is treated as dead too.
export const PUSH_EXPIRY_DAYS = 60
