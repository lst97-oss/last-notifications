import { and, asc, count, eq, inArray, lte, notExists, sql } from 'drizzle-orm'
import { type BusinessDb, getBusinessDb } from '@/server/db/business-sql'
import { apps, notificationDeliveries, notifications } from '@/server/db/schema'
import type { NotificationChannelKind } from '@/server/db/vocabularies'
import { type AppChannelRuntime, loadAppChannelRuntime } from '@/server/modules/apps/infrastructure/app-repository'
import type { NotificationRecord } from '@/server/modules/notifications/domain/notification'
import { purgeArchivedNotifications } from '@/server/modules/notifications/infrastructure/notification-repository'
import { purgeExpiredRecipientTokens } from '@/server/modules/notifications/infrastructure/recipient-token-repository'
import { getRequestLogger } from '@/server/observability/logger'
import { getNotificationChannels } from '@/server/plugins/config'
import { type AppChannelSettings, ChannelError, type NotificationChannel } from '@/server/plugins/notification-channels'
import { purgeFailedPushSubscriptions } from '@/server/plugins/webpush/webpush.plugin'
import { withTimeout } from '@/server/plugins/with-timeout'
import { openSecret, SecretBoxError } from '@/server/security/secret-box'

export const MAX_ATTEMPTS = 8
export const HANDLER_TIMEOUT_MS = 30_000
export const BATCH_SIZE = 20
// A claim must outlive a full batch of sends, which run one after another. A shorter lease lets a second
// worker claim rows this worker is still sending, so they go out twice.
export const DELIVERY_LEASE_MS = BATCH_SIZE * HANDLER_TIMEOUT_MS + 60_000
// Delivered notifications stay this long for audit, then go with their deliveries.
const EVENT_RETENTION_MS = 30 * 86_400_000

const logger = getRequestLogger().child({ component: 'channel-delivery' })

// What a send may use for one app. A sealed secret that cannot be opened (the key changed, or is
// missing) is flagged rather than dropped, so the send fails instead of signing with another key.
export function appChannelSettings(runtime: AppChannelRuntime | undefined): AppChannelSettings {
  const config = runtime?.config ?? {}
  if (!runtime?.signingSecretEncrypted) return { config, signingSecret: null, secretUnreadable: false }
  try {
    return { config, signingSecret: openSecret(runtime.signingSecretEncrypted), secretUnreadable: false }
  } catch (error) {
    if (error instanceof SecretBoxError) return { config, signingSecret: null, secretUnreadable: true }
    throw error
  }
}

// Puts one dead-letter delivery back in the queue. Any other status is left alone: a pending or
// processing row is being worked on, and a delivered row was already sent, so resetting it would send again.
export async function requeueDeadLetter(db: BusinessDb, deliveryId: string): Promise<boolean> {
  const updated = await db
    .update(notificationDeliveries)
    .set({ status: 'pending', attempts: 0, nextAttemptAt: new Date(), lastError: null })
    .where(and(eq(notificationDeliveries.id, deliveryId), eq(notificationDeliveries.status, 'dead_letter')))
    .returning({ id: notificationDeliveries.id })
  return updated.length > 0
}

export function getChannelRetryDelayMs(attempt: number): number {
  return Math.min(1_000 * 2 ** Math.max(0, attempt - 1), 3_600_000)
}

// One locked claim per batch: SKIP LOCKED means two workers never take the same
// row, and the lease (next_attempt_at) moves forward in the same write. A crashed
// worker's rows come due again once the lease expires.
export async function deliverPendingChannelDeliveries(
  db: BusinessDb = getBusinessDb(),
  now: Date = new Date(),
  channels: readonly NotificationChannel[] = getNotificationChannels(),
  stop?: AbortSignal,
): Promise<number> {
  const claimed = await db
    .update(notificationDeliveries)
    .set({
      status: 'processing',
      attempts: sql`${notificationDeliveries.attempts} + 1`,
      nextAttemptAt: new Date(now.getTime() + DELIVERY_LEASE_MS),
    })
    .where(
      inArray(
        notificationDeliveries.id,
        db
          .select({ id: notificationDeliveries.id })
          .from(notificationDeliveries)
          .where(
            and(
              inArray(notificationDeliveries.status, ['pending', 'processing']),
              lte(notificationDeliveries.nextAttemptAt, now),
            ),
          )
          .orderBy(asc(notificationDeliveries.nextAttemptAt))
          .limit(BATCH_SIZE)
          .for('update', { skipLocked: true }),
      ),
    )
    .returning({
      id: notificationDeliveries.id,
      notificationId: notificationDeliveries.notificationId,
      channel: notificationDeliveries.channel,
      attempts: notificationDeliveries.attempts,
      addressOverride: notificationDeliveries.addressOverride,
    })
  if (claimed.length === 0) return 0

  const rows = await db
    .select({
      notification: notifications,
      app: { id: apps.id, key: apps.key, name: apps.name },
    })
    .from(notifications)
    .innerJoin(apps, eq(apps.id, notifications.appId))
    .where(
      inArray(
        notifications.id,
        claimed.map((delivery) => delivery.notificationId),
      ),
    )
  const byId = new Map(rows.map((row) => [row.notification.id, row]))

  // One batched read per channel in this claim, so each delivery gets its app's settings without a query each.
  const appIds = [...new Set(rows.map((row) => row.app.id))]
  const runtimeByChannel = new Map<string, Map<string, AppChannelRuntime>>()
  for (const channelName of new Set(claimed.map((delivery) => delivery.channel))) {
    runtimeByChannel.set(channelName, await loadAppChannelRuntime(appIds, channelName as NotificationChannelKind, db))
  }

  let processed = 0
  for (const [index, delivery] of claimed.entries()) {
    if (stop?.aborted) {
      // Shutdown: hand the unsent rest of the claim back now, not after the lease runs out. The claim
      // counted as an attempt that never ran, so undo that too.
      await db
        .update(notificationDeliveries)
        .set({ status: 'pending', nextAttemptAt: now, attempts: sql`${notificationDeliveries.attempts} - 1` })
        .where(
          inArray(
            notificationDeliveries.id,
            claimed.slice(index).map((row) => row.id),
          ),
        )
      logger.info('shutdown.handed_back', { count: claimed.length - index })
      break
    }
    const target = byId.get(delivery.notificationId)
    if (!target) continue
    processed += 1
    const channel = channels.find((candidate) => candidate.channel === delivery.channel)
    try {
      if (!channel) throw new ChannelError('CHANNEL_NOT_REGISTERED')
      const notification = toNotificationRecord(target.notification)
      const settings = appChannelSettings(runtimeByChannel.get(delivery.channel)?.get(target.app.id))
      await withTimeout(
        HANDLER_TIMEOUT_MS,
        (signal) =>
          channel.send({
            notification,
            app: target.app,
            recipientKey: notification.recipientKey,
            addressOverride: delivery.addressOverride ?? undefined,
            settings,
            signal,
          }),
        () => new ChannelError('HANDLER_TIMEOUT'),
      )
      await db
        .update(notificationDeliveries)
        // The one-shot address has done its job; keeping it would store an address nobody asked us to keep.
        .set({ status: 'delivered', deliveredAt: new Date(), lastError: null, addressOverride: null })
        .where(eq(notificationDeliveries.id, delivery.id))
    } catch (error) {
      const code = error instanceof ChannelError ? error.code : 'SEND_FAILED'
      const retryable = error instanceof ChannelError ? error.retryable : true
      const missingChannel = code === 'CHANNEL_NOT_REGISTERED'
      const exhausted = delivery.attempts >= MAX_ATTEMPTS
      const deadLetter = missingChannel || !retryable || exhausted
      await db
        .update(notificationDeliveries)
        .set({
          status: deadLetter ? 'dead_letter' : 'pending',
          nextAttemptAt: new Date(now.getTime() + getChannelRetryDelayMs(delivery.attempts)),
          lastError: code,
        })
        .where(eq(notificationDeliveries.id, delivery.id))
      logger.warn('channel.delivery.failed', {
        channel: delivery.channel,
        attempt: delivery.attempts,
        status: deadLetter ? 'dead_letter' : 'pending',
        code,
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return processed
}

// Rows the worker still owes or has parked, per channel and status, for the worker's status line.
// shortcut: unindexed count over notification_deliveries on each status line, fine while the table is small; add a partial index on status when it grows.
export function countDeliveryQueue(db: BusinessDb = getBusinessDb()) {
  return db
    .select({ channel: notificationDeliveries.channel, status: notificationDeliveries.status, count: count() })
    .from(notificationDeliveries)
    .where(inArray(notificationDeliveries.status, ['pending', 'processing', 'dead_letter']))
    .groupBy(notificationDeliveries.channel, notificationDeliveries.status)
}

// Removes email-only notifications whose every delivery finished, once they are older than
// the retention window. Inbox rows are never removed here: they leave through
// purgeArchivedNotifications, after the user archives them. A pending or dead-letter
// delivery keeps its notification so a retry or an investigation still has it.
export async function purgeDeliveredNotifications(
  db: BusinessDb = getBusinessDb(),
  now: Date = new Date(),
): Promise<number> {
  const removed = await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.inapp, false),
        lte(notifications.createdAt, new Date(now.getTime() - EVENT_RETENTION_MS)),
        notExists(
          db
            .select({ id: notificationDeliveries.id })
            .from(notificationDeliveries)
            .where(
              and(
                eq(notificationDeliveries.notificationId, notifications.id),
                inArray(notificationDeliveries.status, ['pending', 'processing', 'dead_letter']),
              ),
            ),
        ),
      ),
    )
    .returning({ id: notifications.id })
  return removed.length
}

// One hourly pass for everything that can accumulate: delivered notifications,
// expired recipient tokens, and (added by the web-push plugin) dead subscriptions.
export async function purgeExpiredState(db: BusinessDb = getBusinessDb(), now: Date = new Date()): Promise<void> {
  await purgeDeliveredNotifications(db, now)
  await purgeArchivedNotifications(db, now)
  await purgeExpiredRecipientTokens(db, now)
  await purgeFailedPushSubscriptions(db, now)
}

function toNotificationRecord(row: typeof notifications.$inferSelect): NotificationRecord {
  return {
    id: row.id,
    appId: row.appId,
    recipientKey: row.recipientKey,
    type: row.type,
    title: row.title,
    body: row.body,
    data: (row.data ?? {}) as Record<string, unknown>,
    priority: row.priority,
    dedupeKey: row.dedupeKey,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }
}
