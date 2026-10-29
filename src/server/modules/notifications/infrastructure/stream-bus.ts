import { getBusinessSql } from '@/server/db/business-sql'
import { encodeCursor, type NotificationRecord } from '@/server/modules/notifications/domain/notification'
import { getNotificationById } from '@/server/modules/notifications/infrastructure/notification-repository'
import { countRecipientSubscribers, publishToRecipient } from '@/server/modules/notifications/infrastructure/stream-hub'
import { getRequestLogger } from '@/server/observability/logger'

const CHANNEL = 'notification_events'
const logger = getRequestLogger().child({ component: 'stream-bus' })

// One id per process, so a listener ignores the NOTIFY its own publish produced
// (the hub already delivered it) and only fans out remote instances' events.
const instanceId = crypto.randomUUID()

type Wire = { p: string; a: string; r: string; i: string }

// The two ports this module needs. Production passes the Bun SQL client and the repository;
// tests pass fakes.
export type BusListener = {
  listen(channel: string, onPayload: (payload: string) => void): Promise<{ unlisten: () => Promise<void> }>
}
export type BusDeps = {
  listener?: BusListener
  loadNotification?: (id: string) => Promise<NotificationRecord | null>
}

let subscription: { unlisten: () => Promise<void> } | null = null
let starting: Promise<boolean> | null = null

// Enables cross-process fan-out. Returns false when the driver cannot LISTEN
// (in which case the in-process hub still works, for a single instance). A failure is not
// remembered: the next call tries again.
export function startStreamBus(deps: BusDeps = {}): Promise<boolean> {
  if (!starting) {
    starting = (async () => {
      try {
        const listener = deps.listener ?? getBusinessSql()
        const load = deps.loadNotification ?? getNotificationById
        subscription = await listener.listen(CHANNEL, (payload) => {
          void handlePayload(payload, load)
        })
        logger.info('stream.bus.listening', { channel: CHANNEL })
        return true
      } catch (error) {
        logger.warn('stream.bus.unavailable', {
          message: error instanceof Error ? error.message : String(error),
        })
        subscription = null
        starting = null
        return false
      }
    })()
  }
  return starting
}

export async function stopStreamBus(): Promise<void> {
  const current = subscription
  subscription = null
  starting = null
  if (!current) return
  try {
    await current.unlisten()
  } catch {
    // Shutdown must not fail on a dead connection.
  }
}

// Local hub first (the subscriber lives on this process), then NOTIFY so other
// instances deliver to their own connections.
export async function publishNotificationEvent(
  appId: string,
  recipientKey: string,
  notification: NotificationRecord,
): Promise<void> {
  publishToRecipient(appId, recipientKey, {
    cursor: encodeCursor({ t: notification.createdAt, i: notification.id }),
    notification,
  })
  const wire: Wire = { p: instanceId, a: appId, r: recipientKey, i: notification.id }
  try {
    await getBusinessSql().notify(CHANNEL, JSON.stringify(wire))
  } catch (error) {
    logger.warn('stream.bus.notify_failed', {
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

async function handlePayload(payload: string, load: (id: string) => Promise<NotificationRecord | null>): Promise<void> {
  let wire: Wire
  try {
    wire = JSON.parse(payload) as Wire
  } catch {
    return
  }
  if (!wire || wire.p === instanceId || typeof wire.i !== 'string') return
  // Nobody on this instance is streaming to this recipient, so the row is not needed here.
  if (countRecipientSubscribers(wire.a, wire.r) === 0) return
  try {
    const notification = await load(wire.i)
    if (!notification) return
    publishToRecipient(wire.a, wire.r, {
      cursor: encodeCursor({ t: notification.createdAt, i: notification.id }),
      notification,
    })
  } catch (error) {
    logger.warn('stream.bus.fanout_failed', {
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
