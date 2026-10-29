import { z } from 'zod'

import { definePluginConfig } from '@/server/plugins/plugin-config'

// Every non-secret email setting lives in this file: pick a provider, give the
// sender identity, and (for `custom`) the endpoint. SMTP_PASS is the one secret
// and comes from the environment. Adding a provider = one registry entry.
const EMAIL_PROVIDERS = {
  // Implicit TLS; the credential is a Google App Password, not the account password.
  gmail: { host: 'smtp.gmail.com', port: 465, secure: true },
  // STARTTLS; nodemailer upgrades automatically on 587.
  microsoft365: { host: 'smtp.office365.com', port: 587, secure: false },
  // Endpoint comes from the `custom` block below (local relay, self-hosted MTA).
  custom: null,
} as const

export type EmailProviderId = keyof typeof EMAIL_PROVIDERS

const PROVIDER_IDS = Object.keys(EMAIL_PROVIDERS) as [EmailProviderId, ...EmailProviderId[]]

const fileSchema = z.strictObject({
  provider: z.enum(PROVIDER_IDS).default('gmail'),
  // SMTP username, and the From address unless `from` overrides it. Gmail only
  // sends as the authenticated account, so one value covers both there.
  user: z.string().trim().min(1).optional(),
  from: z.email().optional(),
  // Reply-To for the notification mail; defaults to `from`.
  replyTo: z.email().optional(),
  // Endpoint for provider "custom".
  custom: z
    .object({
      host: z.string().trim().min(1),
      port: z.number().int().min(1).max(65_535).default(587),
      secure: z.boolean().default(false),
    })
    .optional(),
})

export type EmailConfig = {
  configured: boolean
  // A config that cannot work at all (e.g. `custom` without an endpoint). Surfaced
  // by describe() and by the delivery's last_error — never thrown from resolve().
  configError: string | null
  provider: EmailProviderId
  host: string | null
  port: number
  secure: boolean
  user: string | null
  pass: string | null
  from: string | null
  replyTo: string | null
}

// The operator-editable config. Gmail example:
//
//   emailConfig = {
//     provider: 'gmail',
//     user: 'you@gmail.com',          // From defaults to this
//   }
//
// passes in .env: SMTP_PASS=<16-char App Password>
export const emailConfig = {
  provider: 'gmail',
  user: 'laisiotou1997@gmail.com',
} satisfies z.infer<typeof fileSchema>

export const emailConfigDef = definePluginConfig({
  id: 'email',
  fileSchema,
  defaults: emailConfig,
  resolve: (file, env): EmailConfig => {
    const user = file.user ?? null
    const from = file.from ?? file.user ?? null
    const pass = env.SMTP_PASS?.trim() || null
    const preset = EMAIL_PROVIDERS[file.provider]
    const endpoint = preset ?? file.custom ?? null

    if (!endpoint) {
      return {
        configured: false,
        configError:
          'Provider "custom" needs a custom: { host, port, secure } block in src/server/plugins/email/email.config.ts',
        provider: file.provider,
        host: null,
        port: 587,
        secure: false,
        user,
        pass,
        from,
        replyTo: file.replyTo ?? from,
      }
    }

    return {
      // A preset always authenticates; a custom relay may be unauthenticated.
      configured: preset ? Boolean(from && user && pass) : Boolean(from),
      configError: null,
      provider: file.provider,
      host: endpoint.host,
      port: endpoint.port,
      secure: endpoint.secure,
      user,
      pass,
      from,
      replyTo: file.replyTo ?? from,
    }
  },
})

export function getEmailConfig(source?: Record<string, string | undefined>): EmailConfig {
  const env = source ?? (typeof Bun !== 'undefined' ? (Bun.env as Record<string, string | undefined>) : process.env)
  return emailConfigDef.resolve(fileSchema.parse(emailConfigDef.defaults), env)
}
