import { closeBusinessSql, getBusinessDb } from '@/server/db/business-sql'
import { getRequestLogger } from '@/server/observability/logger'
import {
  BATCH_SIZE,
  countDeliveryQueue,
  DELIVERY_LEASE_MS,
  deliverPendingChannelDeliveries,
  HANDLER_TIMEOUT_MS,
  MAX_ATTEMPTS,
  purgeExpiredState,
} from '@/server/plugins/channel-delivery'
import { getNotificationChannels } from '@/server/plugins/config'
import { nextPauseMs } from '@/server/plugins/worker-pause'

// Async channel delivery: email, Web Push, and every vendor channel added later.
// Runs as its own process so a slow SMTP or push endpoint never blocks a publish.
const logger = getRequestLogger().child({ component: 'channel-worker' })
const hasChannels = getNotificationChannels().length > 0
let stopping = false
// Aborted by a stop signal: the send in flight finishes, the unsent rest of the batch is handed back.
const stopController = new AbortController()
let wake = () => {}
let stoppedAt = 0
const stop = (signal: string) => {
  stoppedAt = performance.now()
  logger.info('shutdown.signal', { signal })
  stopping = true
  stopController.abort()
  wake()
}
process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))

// Sleeps for `ms`, or returns early when a stop signal arrives.
function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    wake = () => {
      clearTimeout(timer)
      resolve()
    }
  })
}

// Retention runs at most hourly, and only as part of a delivery pass, so no second
// scheduler is needed.
const PURGE_EVERY_MS = 3_600_000
let lastPurge = 0
// The status line is one count query, so it runs every five minutes. The first one runs after the first pass.
const STATUS_EVERY_MS = 300_000
let lastStatus = 0
const startedAt = Date.now()
// Deliveries this process handled since the last status line.
let handled = 0
// Consecutive failed passes. Each one waits longer, so an outage logs once per backoff step, not per second.
let failures = 0

logger.info('channel.worker.started', {
  batchSize: BATCH_SIZE,
  maxAttempts: MAX_ATTEMPTS,
  handlerTimeoutMs: HANDLER_TIMEOUT_MS,
  leaseMs: DELIVERY_LEASE_MS,
  purgeEveryMs: PURGE_EVERY_MS,
  statusEveryMs: STATUS_EVERY_MS,
})
// One line per installed plugin. `delivery: inline` plugins are sent by the publish call, not by this worker.
for (const channel of getNotificationChannels()) {
  const { id, enabled, detail, facts } = channel.describe()
  logger.info('channel.plugin.loaded', {
    id,
    delivery: channel.delivery ?? 'outbox',
    enabled,
    detail,
    // A record prints as `label: value` lines; the plugin contract stays a list.
    facts: Object.fromEntries(facts.map(({ label, value }) => [label, value])),
  })
}
while (!stopping) {
  let batchWasFull = false
  try {
    const processed = await deliverPendingChannelDeliveries(
      getBusinessDb(),
      new Date(),
      getNotificationChannels(),
      stopController.signal,
    )
    handled += processed
    batchWasFull = processed === BATCH_SIZE
    failures = 0
    if (Date.now() - lastPurge >= PURGE_EVERY_MS) {
      lastPurge = Date.now()
      await purgeExpiredState()
    }
    if (Date.now() - lastStatus >= STATUS_EVERY_MS) {
      lastStatus = Date.now()
      logger.info('channel.worker.status', {
        uptimeMs: Date.now() - startedAt,
        handledSinceLast: handled,
        queue: await countDeliveryQueue(),
      })
      handled = 0
    }
  } catch (error) {
    failures += 1
    logger.error('channel.worker.poll_failed', {
      failures,
      retryInMs: nextPauseMs({ hasChannels, batchWasFull, failures }),
      message: error instanceof Error ? error.message : String(error),
    })
  }
  const pauseMs = nextPauseMs({ hasChannels, batchWasFull, failures })
  if (!stopping && pauseMs > 0) await pause(pauseMs)
}

logger.info('channel.worker.stopped')
await closeBusinessSql()
logger.info('shutdown.drained', { durationMs: Math.round(performance.now() - stoppedAt) })
logger.info('shutdown.exit', { code: 0 })
