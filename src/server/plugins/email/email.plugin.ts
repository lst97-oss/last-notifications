import { and, eq } from 'drizzle-orm'
import nodemailer, { type Transporter } from 'nodemailer'

import type { ChannelFact } from '@/lib/channel-facts'
import { type BusinessDb, getBusinessDb } from '@/server/db/business-sql'
import { recipientContacts } from '@/server/db/schema'
import { createUnsubscribeToken } from '@/server/modules/notifications/domain/unsubscribe-token'
import { type EmailConfig, getEmailConfig } from '@/server/plugins/email/email.config'
import { parseEmailStyle } from '@/server/plugins/email/email.style'
import { renderDefaultTheme } from '@/server/plugins/email/themes/default'
import { ChannelError, type NotificationChannel } from '@/server/plugins/notification-channels'

type EmailDeps = {
  db?: BusinessDb
  transport?: Pick<Transporter, 'sendMail'>
  config?: EmailConfig
}

// One transporter per process: building one per send leaks SMTP connections.
let sharedTransport: Pick<Transporter, 'sendMail'> | null = null

function transportFor(config: EmailConfig): Pick<Transporter, 'sendMail'> {
  if (sharedTransport) return sharedTransport
  sharedTransport = nodemailer.createTransport({
    host: config.host ?? '127.0.0.1',
    port: config.port,
    secure: config.secure,
    ...(config.user && config.pass ? { auth: { user: config.user, pass: config.pass } } : {}),
  })
  return sharedTransport
}

function describeDetail(config: EmailConfig): string {
  if (config.configError) return config.configError
  const endpoint = `${config.host}:${config.port}`
  if (config.provider === 'custom') {
    return config.configured
      ? `SMTP ${endpoint}`
      : 'Set from in src/server/plugins/email/email.config.ts to enable email'
  }
  return config.configured
    ? `${config.provider} via ${endpoint}`
    : `Set ${
        config.user ? 'SMTP_PASS in .env' : 'user in src/server/plugins/email/email.config.ts and SMTP_PASS in .env'
      } to enable email via ${config.provider}`
}

// What the dashboard can safely show: presence of a secret, never its value.
function describeFacts(config: EmailConfig): ChannelFact[] {
  return [
    { label: 'Provider', value: config.provider },
    { label: 'Endpoint', value: `${config.host ?? 'not set'}:${config.port}${config.secure ? ' (TLS)' : ''}` },
    { label: 'From', value: config.from ?? 'not set' },
    ...(config.replyTo ? [{ label: 'Reply-to', value: config.replyTo }] : []),
    { label: 'Credentials', value: config.pass ? 'SMTP_PASS set' : 'SMTP_PASS missing' },
  ]
}

export function createEmailChannel(deps: EmailDeps = {}): NotificationChannel {
  return {
    id: 'email',
    apiVersion: 1,
    channel: 'email',
    describe: () => {
      const config = deps.config ?? getEmailConfig()
      return {
        id: 'email',
        apiVersion: 1,
        enabled: config.configured,
        detail: describeDetail(config),
        facts: describeFacts(config),
        channels: ['email'],
      }
    },
    async send({ notification, app, recipientKey, addressOverride, signal }) {
      const config = deps.config ?? getEmailConfig()
      if (config.configError) throw new ChannelError('EMAIL_NOT_CONFIGURED', config.configError)
      if (!config.configured || !config.from) throw new ChannelError('EMAIL_NOT_CONFIGURED')
      if (signal.aborted) throw new ChannelError('HANDLER_TIMEOUT')

      const db = deps.db ?? getBusinessDb()
      // A one-shot override wins; the stored address is the fallback. Missing both
      // is a visible dead letter, not a silent drop.
      const address = addressOverride ?? (await storedAddress(db, notification.appId, recipientKey))
      // Retrying cannot add an address, so this dead-letters at once instead of spending eight attempts.
      if (!address) throw new ChannelError('NO_RECIPIENT_ADDRESS', undefined, { retryable: false })

      const style = parseEmailStyle(notification.data)
      const actionUrl = typeof notification.data.url === 'string' ? notification.data.url : undefined
      const { html, text } = renderDefaultTheme(
        { appName: app.name, title: notification.title, body: notification.body, actionUrl },
        style,
      )
      const unsubscribeUrl = buildUnsubscribeUrl(
        { appId: app.id, appKey: app.key, recipientKey, email: address },
        typeof Bun !== 'undefined' ? Bun.env : process.env,
      )

      await (deps.transport ?? transportFor(config)).sendMail({
        from: config.from,
        to: address,
        ...(config.replyTo ? { replyTo: config.replyTo } : {}),
        subject: notification.title,
        text,
        html,
        headers: {
          // RFC 8058 one-click: the mail client POSTs the URL with no body.
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      })
    },
  }
}

export const emailChannel = createEmailChannel()

async function storedAddress(db: BusinessDb, appId: string, recipientKey: string): Promise<string | null> {
  const [row] = await db
    .select({ address: recipientContacts.address })
    .from(recipientContacts)
    .where(
      and(
        eq(recipientContacts.appId, appId),
        eq(recipientContacts.recipientKey, recipientKey),
        eq(recipientContacts.channel, 'email'),
      ),
    )
    .limit(1)
  return row?.address ?? null
}

// The unsubscribe link has to be absolute, and the worker has no request to derive
// an origin from. BETTER_AUTH_URL is this server's public origin and is already
// required to run at all, so it is the one source — never the Payload bootstrap env.
function publicOrigin(env: Record<string, string | undefined>): string {
  const raw = env.BETTER_AUTH_URL?.trim()
  if (!raw) throw new ChannelError('PUBLIC_ORIGIN_MISSING')
  return new URL(raw).origin
}

function buildUnsubscribeUrl(
  input: { appId: string; appKey: string; recipientKey: string; email: string },
  env: Record<string, string | undefined>,
): string {
  const token = createUnsubscribeToken(input.appId, input.recipientKey, input.email)
  const origin = publicOrigin(env)
  const params = new URLSearchParams({
    appKey: input.appKey,
    recipientKey: input.recipientKey,
    email: input.email,
    token,
  })
  return `${origin}/api/v1/unsubscribe?${params.toString()}`
}
