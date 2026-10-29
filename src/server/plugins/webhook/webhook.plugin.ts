import { createHmac } from 'node:crypto'

import { HttpStatus } from '@lst97-oss/last-httprism'
import type { ChannelFact } from '@/lib/channel-facts'
import { type BusinessDb, getBusinessDb } from '@/server/db/business-sql'
import { webhookUrlProblem } from '@/server/modules/notifications/domain/webhook-url'
import { getRecipientChannelAddress } from '@/server/modules/notifications/infrastructure/notification-repository'
import { ChannelError, type ChannelStatus, type NotificationChannel } from '@/server/plugins/notification-channels'
import { postWebhook, type WebhookPost } from '@/server/plugins/webhook/safe-http'
import { getWebhookPluginSettings, type ResolvedWebhookConfig } from '@/server/plugins/webhook/webhook.config'
import { parseWebhookStyle } from '@/server/plugins/webhook/webhook.style'

// Receivers verify `t=<unix>,v1=<hex>`: HMAC-SHA256 over `<t>.<body>` with the instance signing secret.
// Checking `t` against their own clock bounds replay; `x-last-notifications-delivery` dedupes it.
export function signWebhookBody(secret: string, timestampSeconds: number, body: string): string {
  const digest = createHmac('sha256', secret).update(`${timestampSeconds}.${body}`).digest('hex')
  return `t=${timestampSeconds},v1=${digest}`
}

export function createWebhookChannel(
  deps: { db?: BusinessDb; config?: ResolvedWebhookConfig; post?: WebhookPost; now?: () => Date } = {},
): NotificationChannel {
  const db = () => deps.db ?? getBusinessDb()
  const config = deps.config ?? getWebhookPluginSettings()
  const post = deps.post ?? postWebhook
  const now = deps.now ?? (() => new Date())

  const facts: ChannelFact[] = [
    { label: 'Server signing secret', value: config.signingSecret ? 'set' : 'not set (WEBHOOK_SIGNING_SECRET)' },
    {
      label: 'Per-app secrets',
      value: config.perAppSecrets ? 'enabled' : 'disabled (set SECRET_ENCRYPTION_KEY)',
    },
    { label: 'Timeout', value: `${config.timeoutMs} ms` },
    { label: 'Private networks', value: config.allowPrivateNetworks ? 'allowed (development)' : 'blocked' },
  ]
  // A channel is usable when some secret can sign: the server's own, or one each app registers.
  const usable = config.signingSecret !== undefined || config.perAppSecrets
  const detail = (): string => {
    if (config.perAppSecrets && config.signingSecret) {
      return 'Signed with the app’s own secret, or the server secret when an app has none'
    }
    if (config.perAppSecrets) return 'Signed with each app’s own secret; an app must register one first'
    if (config.signingSecret) return 'Signed with the server secret'
    return 'Unsigned deliveries are refused: set SECRET_ENCRYPTION_KEY, or WEBHOOK_SIGNING_SECRET (16+ characters)'
  }

  return {
    id: 'webhook',
    apiVersion: 1,
    channel: 'webhook',
    describe: (): ChannelStatus => ({
      id: 'webhook',
      apiVersion: 1,
      enabled: usable,
      detail: detail(),
      facts,
      channels: ['webhook'],
    }),
    async send({ notification, app, recipientKey, settings, signal }) {
      if (settings.secretUnreadable) {
        throw new ChannelError(
          'APP_SIGNING_SECRET_UNREADABLE',
          'The app signing secret cannot be opened; rotate it from the host',
          { retryable: false },
        )
      }
      // The app's own secret signs its deliveries; the server-wide secret covers apps that never registered one.
      const signingSecret = settings.signingSecret ?? config.signingSecret
      if (!signingSecret) {
        throw new ChannelError('WEBHOOK_NOT_CONFIGURED', 'No signing secret for this app or the server', {
          retryable: false,
        })
      }
      // The recipient's own URL wins; the app's endpoint is the fallback. Exactly one POST either way.
      const recipientUrl = await getRecipientChannelAddress(
        { appId: notification.appId, recipientKey, channel: 'webhook' },
        db(),
      )
      const appEndpoint = typeof settings.config.endpointUrl === 'string' ? settings.config.endpointUrl : null
      const url = recipientUrl ?? appEndpoint
      if (!url) throw new ChannelError('NO_RECIPIENT_ADDRESS', undefined, { retryable: false })
      // Re-checked on every send: a stored row written before a policy change must not be posted to.
      const problem = webhookUrlProblem(url, { allowPrivate: config.allowPrivateNetworks })
      if (problem) throw new ChannelError('WEBHOOK_URL_BLOCKED', problem, { retryable: false })

      const body = JSON.stringify({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        priority: notification.priority,
        createdAt: notification.createdAt,
        recipientKey,
        app: { key: app.key, name: app.name },
      })
      const event = parseWebhookStyle(notification.data).event ?? 'notification'
      const signature = signWebhookBody(signingSecret, Math.floor(now().getTime() / 1000), body)
      const { status } = await post(url, body, {
        headers: {
          'x-last-notifications-event': event,
          'x-last-notifications-delivery': notification.id,
          'x-last-notifications-signature': signature,
        },
        timeoutMs: config.timeoutMs,
        signal,
        allowPrivate: config.allowPrivateNetworks,
      })

      if (status >= HttpStatus.OK.code && status < HttpStatus.MULTIPLE_CHOICES.code) return
      // Receivers that are busy, rate-limiting or failing are worth retrying; a 4xx that names the request
      // as wrong (404 gone, 410, 400) is not, so it dead-letters instead of burning eight attempts.
      const retryable =
        status === HttpStatus.REQUEST_TIMEOUT.code ||
        status === HttpStatus.TOO_MANY_REQUESTS.code ||
        status >= HttpStatus.INTERNAL_SERVER_ERROR.code
      throw new ChannelError(`WEBHOOK_HTTP_${status}`, `Receiver answered ${status}`, { retryable })
    },
  }
}

export const webhookChannel = createWebhookChannel()
