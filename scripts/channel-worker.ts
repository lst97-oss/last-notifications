import { closeBusinessSql } from '@/server/db/business-sql'
import { getRequestLogger } from '@/server/observability/logger'
import { BATCH_SIZE, deliverPendingChannelDeliveries, purgeExpiredState } from '@/server/plugins/channel-delivery'
import { getNotificationChannels } from '@/server/plugins/config'

// Async channel delivery: email, Web Push, and every vendor channel added later.
// Runs as its own process so a slow SMTP or push endpoint never blocks a publish.
const logger = getRequestLogger().child({ component: 'channel-worker' })
const hasChannels = getNotificationChannels().length > 0
const IDLE_MS = 2 ** 31 - 1 // setTimeout's maximum delay
let stopping = false
let wake = () => {}
const stop = () => {
  stopping = true
  wake()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

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

while (!stopping) {
  let batchWasFull = false
  try {
    batchWasFull = (await deliverPendingChannelDeliveries()) === BATCH_SIZE
    if (Date.now() - lastPurge >= PURGE_EVERY_MS) {
      lastPurge = Date.now()
      await purgeExpiredState()
    }
  } catch {
    logger.error('channel.worker.poll_failed')
  }
  // A full batch means more is due, so the next pass starts now. Only a short pass waits.
  if (!stopping && !batchWasFull) await pause(hasChannels ? 1_000 : IDLE_MS)
}

await closeBusinessSql()
