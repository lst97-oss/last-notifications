import { type BusinessDb, getBusinessDb } from '@/server/db/business-sql'
import { asyncDeliveryChannels, resolveTargetChannels } from '@/server/modules/notifications/domain/notification'
import {
  ensureRecipient,
  insertDeliveries,
  insertNotification,
  loadChannelContext,
} from '@/server/modules/notifications/infrastructure/notification-repository'
import { publishNotificationEvent } from '@/server/modules/notifications/infrastructure/stream-bus'

export type PublishNotificationInput = {
  app: { id: string; key: string; name: string }
  recipientKey: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  priority: number
  channels?: readonly string[]
  dedupeKey?: string | null
  emailOverride?: string
}

export type PublishNotificationDeps = {
  db?: BusinessDb
  notify?: typeof publishNotificationEvent
}

// One transaction writes the inbox row and one outbox row per async channel, then
// the fan-out runs after commit so a streaming failure can never roll back a
// notification that was already stored.
export async function publishNotification(
  input: PublishNotificationInput,
  deps: PublishNotificationDeps = {},
): Promise<{ id: string; duplicate: boolean; channels: string[] }> {
  const db = deps.db ?? getBusinessDb()
  const notify = deps.notify ?? publishNotificationEvent

  const context = await loadChannelContext(input.app.id, input.recipientKey, db)
  const channels = resolveTargetChannels({
    requested: input.channels,
    appChannels: context.appChannels,
    preferences: context.preferences,
  })

  const result = await db.transaction(async (tx) => {
    await ensureRecipient(tx, { appId: input.app.id, recipientKey: input.recipientKey })
    const inserted = await insertNotification(tx, {
      appId: input.app.id,
      recipientKey: input.recipientKey,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
      priority: input.priority,
      dedupeKey: input.dedupeKey ?? null,
      inapp: channels.includes('inapp'),
    })
    if (inserted.duplicate) return inserted
    const asyncChannels = asyncDeliveryChannels(channels)
    await insertDeliveries(tx, inserted.record.id, asyncChannels, input.emailOverride)
    return inserted
  })

  if (!result.duplicate && channels.includes('inapp')) {
    await notify(input.app.id, input.recipientKey, result.record)
  }

  return { id: result.record.id, duplicate: result.duplicate, channels: [...channels] }
}
