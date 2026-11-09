import { type BusinessDb, getBusinessDb } from '@/server/db/business-sql'
import { resolveTargetChannels } from '@/server/modules/notifications/domain/notification'
import {
  ensureRecipient,
  insertDeliveries,
  insertNotification,
  loadChannelContext,
} from '@/server/modules/notifications/infrastructure/notification-repository'
import { getRequestLogger } from '@/server/observability/logger'
import { getNotificationChannels } from '@/server/plugins/config'
import type { AppChannelSettings, NotificationChannel } from '@/server/plugins/notification-channels'

const logger = getRequestLogger().child({ component: 'publish' })
// Inline channels read no per-app settings, so they get an empty one.
const NO_SETTINGS: AppChannelSettings = { config: {}, signingSecret: null, secretUnreadable: false }

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
  // The installed channels. Tests pass fakes; production reads the install list.
  channels?: readonly NotificationChannel[]
}

// One transaction writes the inbox row and one outbox row per outbox channel. Inline channels (in-app's
// live stream) run after commit, so a failure there can never roll back a notification already stored.
export async function publishNotification(
  input: PublishNotificationInput,
  deps: PublishNotificationDeps = {},
): Promise<{ id: string; duplicate: boolean; channels: string[] }> {
  const db = deps.db ?? getBusinessDb()
  const inline = (deps.channels ?? getNotificationChannels()).filter((channel) => channel.delivery === 'inline')
  const inlineNames = new Set<string>(inline.map((channel) => channel.channel))

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
    await insertDeliveries(
      tx,
      inserted.record.id,
      channels.filter((channel) => !inlineNames.has(channel)),
      input.emailOverride,
    )
    return inserted
  })

  if (!result.duplicate) {
    for (const channel of inline) {
      if (!channels.includes(channel.channel)) continue
      try {
        await channel.send({
          notification: result.record,
          app: input.app,
          recipientKey: input.recipientKey,
          settings: NO_SETTINGS,
          // Inline sends are never cancelled: the live stream is a single NOTIFY.
          signal: new AbortController().signal,
        })
      } catch (error) {
        logger.warn('channel.inline.failed', {
          channel: channel.channel,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  return { id: result.record.id, duplicate: result.duplicate, channels: [...channels] }
}
