import { HttpStatus } from '@lst97-oss/last-httprism'
import { and, eq, isNull, lt } from 'drizzle-orm'
import webpush from 'web-push'

import type { ChannelFact } from '@/lib/channel-facts'
import { type BusinessDb, getBusinessDb } from '@/server/db/business-sql'
import { pushSubscriptions } from '@/server/db/schema'
import { isPushServiceEndpoint } from '@/server/modules/notifications/domain/push-endpoint'
import { ChannelError, type NotificationChannel } from '@/server/plugins/notification-channels'
import { getWebpushConfig, PUSH_EXPIRY_DAYS, type WebpushConfig } from '@/server/plugins/webpush/webpush.config'
import { parseWebpushStyle } from '@/server/plugins/webpush/webpush.style'

// One push service call gets this long before it is abandoned.
const PUSH_REQUEST_TIMEOUT_MS = 10_000

// Injected so tests can prove the 404/410 pruning without a push service.
export type WebpushSender = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  options: {
    timeout: number
    TTL: number
    urgency: 'very-low' | 'low' | 'normal' | 'high'
    vapidDetails: { subject: string; publicKey: string; privateKey: string }
  },
) => Promise<{ statusCode?: number }>

type WebpushDeps = {
  db?: BusinessDb
  send?: WebpushSender
  config?: WebpushConfig
  now?: () => Date
}

export function createWebpushChannel(deps: WebpushDeps = {}): NotificationChannel {
  const sendPush: WebpushSender =
    deps.send ??
    ((subscription, payload, options) =>
      webpush.sendNotification(subscription, payload, options) as Promise<{ statusCode?: number }>)

  return {
    id: 'webpush',
    apiVersion: 1,
    channel: 'webpush',
    describe: () => {
      const config = deps.config ?? getWebpushConfig()
      return {
        id: 'webpush',
        apiVersion: 1,
        enabled: config.configured,
        detail: config.configured
          ? 'VAPID keys configured; subscriptions stored per recipient'
          : 'Set VAPID_* to enable browser push',
        facts: [
          {
            label: 'VAPID keys',
            value: config.publicKey && config.privateKey ? 'configured' : 'missing',
          },
          { label: 'Subject', value: config.subject ?? 'not set' },
          { label: 'Subscription TTL', value: `${PUSH_EXPIRY_DAYS} days` },
        ] satisfies ChannelFact[],
        channels: ['webpush'],
      }
    },
    async send({ notification, recipientKey, signal }) {
      const config = deps.config ?? getWebpushConfig()
      if (!config.configured || !config.publicKey || !config.privateKey || !config.subject) {
        throw new ChannelError('WEBPUSH_NOT_CONFIGURED')
      }
      if (signal.aborted) throw new ChannelError('HANDLER_TIMEOUT')

      const db = deps.db ?? getBusinessDb()
      const now = deps.now?.() ?? new Date()
      const stored = await db
        .select({
          id: pushSubscriptions.id,
          endpoint: pushSubscriptions.endpoint,
          p256dh: pushSubscriptions.p256dh,
          auth: pushSubscriptions.auth,
          failureCount: pushSubscriptions.failureCount,
        })
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.appId, notification.appId),
            eq(pushSubscriptions.recipientKey, recipientKey),
            isNull(pushSubscriptions.failedAt),
          ),
        )
      // Rows saved before the endpoint check are skipped, so only browser push services are ever called.
      const subscriptions = stored.filter((subscription) => isPushServiceEndpoint(subscription.endpoint))
      // Retrying cannot add a subscription, so this dead-letters at once instead of spending eight attempts.
      if (subscriptions.length === 0) throw new ChannelError('NO_PUSH_SUBSCRIPTION', undefined, { retryable: false })

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        tag: notification.id,
        data: notification.data,
        ...parseWebpushStyle(notification.data),
      })
      const options = {
        // Bounds one push service call on its own, so a hung endpoint cannot hold the delivery to the handler timeout.
        timeout: PUSH_REQUEST_TIMEOUT_MS,
        TTL: config.ttlSeconds,
        urgency: config.urgency,
        vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
      }

      let delivered = 0
      let lastError = 'PUSH_SEND_FAILED'
      for (const subscription of subscriptions) {
        // The handler's timeout has already rejected this delivery; sending on would only duplicate the retry.
        if (signal.aborted) break
        try {
          await sendPush(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            payload,
            options,
          )
          delivered += 1
          await db
            .update(pushSubscriptions)
            .set({ lastUsedAt: now, failureCount: 0 })
            .where(eq(pushSubscriptions.id, subscription.id))
        } catch (error) {
          const statusCode = statusCodeOf(error)
          lastError = statusCode ? `PUSH_HTTP_${statusCode}` : 'PUSH_SEND_FAILED'
          // 404/410 means the endpoint is gone for good; anything else is retryable
          // and only counts toward pruning.
          await db
            .update(pushSubscriptions)
            .set(
              statusCode === HttpStatus.NOT_FOUND.code || statusCode === HttpStatus.GONE.code
                ? { failedAt: now, failureCount: subscription.failureCount + 1 }
                : { failureCount: subscription.failureCount + 1 },
            )
            .where(eq(pushSubscriptions.id, subscription.id))
        }
      }
      // One live endpoint is enough: the recipient was reached.
      if (delivered === 0) throw new ChannelError(lastError)
    },
  }
}

export const webpushChannel = createWebpushChannel()

// Endpoints that failed permanently go once they are past the expiry window.
export async function purgeFailedPushSubscriptions(
  db: BusinessDb = getBusinessDb(),
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - PUSH_EXPIRY_DAYS * 86_400_000)
  const removed = await db
    .delete(pushSubscriptions)
    .where(and(lt(pushSubscriptions.failedAt, cutoff)))
    .returning({ id: pushSubscriptions.id })
  return removed.length
}

function statusCodeOf(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const value = error.statusCode
    return typeof value === 'number' ? value : null
  }
  return null
}
