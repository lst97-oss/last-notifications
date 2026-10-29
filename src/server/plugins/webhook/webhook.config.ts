import { z } from 'zod'

import { definePluginConfig, loadPluginConfig } from '@/server/plugins/plugin-config'

// Webhook delivery policy. The signing secret stays in WEBHOOK_SIGNING_SECRET. WEBHOOK_ALLOW_PRIVATE=true
// lets a development receiver live on localhost; never set it in production.
export const webhookFileSchema = z.strictObject({
  timeoutMs: z.number().int().min(1_000).max(60_000).default(10_000),
  allowPrivateNetworks: z.boolean().default(false),
})
export type WebhookFileConfig = z.infer<typeof webhookFileSchema>

export const MIN_SIGNING_SECRET_LENGTH = 16

export type ResolvedWebhookConfig = {
  // Undefined unless a secret of at least MIN_SIGNING_SECRET_LENGTH is set: unsigned deliveries never go out.
  signingSecret: string | undefined
  // True when SECRET_ENCRYPTION_KEY is set, so an app can register its own signing secret.
  perAppSecrets: boolean
  timeoutMs: number
  allowPrivateNetworks: boolean
}

export const webhookConfigDef = definePluginConfig({
  id: 'webhook',
  fileSchema: webhookFileSchema,
  defaults: { timeoutMs: 10_000, allowPrivateNetworks: false },
  resolve: (file, env): ResolvedWebhookConfig => {
    const secret = env.WEBHOOK_SIGNING_SECRET?.trim()
    return {
      signingSecret: secret && secret.length >= MIN_SIGNING_SECRET_LENGTH ? secret : undefined,
      perAppSecrets: Boolean(env.SECRET_ENCRYPTION_KEY?.trim()),
      timeoutMs: file.timeoutMs,
      allowPrivateNetworks: file.allowPrivateNetworks || env.WEBHOOK_ALLOW_PRIVATE === 'true',
    }
  },
})

export function getWebhookPluginSettings(
  overrides: { file?: unknown; env?: Record<string, string | undefined> } = {},
): ResolvedWebhookConfig {
  return loadPluginConfig(webhookConfigDef, { file: overrides.file ?? webhookConfigDef.defaults, env: overrides.env })
}
