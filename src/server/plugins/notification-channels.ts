import type { ChannelFact } from '@/lib/channel-facts'
import type { NotificationChannelKind } from '@/server/db/vocabularies'
import type { NotificationRecord } from '@/server/modules/notifications/domain/notification'

// A channel plugin delivers exactly its own channel id (id === channel). Plugins
// are trusted, statically imported server modules — there is no runtime loader:
// installing one means adding it to installedNotificationChannels and deploying.
// What the app configured for this channel, read by the worker for each send. `signingSecret` is
// opened for this send only and never written back. `secretUnreadable` means a sealed secret exists
// but cannot be opened, so the send must refuse rather than fall back to another key.
export type AppChannelSettings = {
  config: Record<string, unknown>
  signingSecret: string | null
  secretUnreadable: boolean
}

export type ChannelSendInput = {
  notification: NotificationRecord
  app: { id: string; key: string; name: string }
  recipientKey: string
  // One-shot address override from the publish request (email only today).
  addressOverride?: string
  settings: AppChannelSettings
  signal: AbortSignal
}

export type ChannelStatus = {
  id: string
  apiVersion: 1
  enabled: boolean
  detail: string
  // Rendered as rows in the dashboard's plugin panel; non-secret only.
  facts: readonly ChannelFact[]
  channels: readonly NotificationChannelKind[]
}

export type NotificationChannel = {
  id: string
  apiVersion: 1
  channel: NotificationChannelKind
  migrations?: { folder: string; schema: string }
  describe: () => ChannelStatus
  send: (input: ChannelSendInput) => Promise<void>
}

// A delivery failure the worker records verbatim in last_error, so operators can
// tell "no address on file" from a vendor outage without reading logs.
export class ChannelError extends Error {
  readonly code: string
  // A non-retryable failure dead-letters on its first attempt (a 404 receiver, a blocked URL).
  readonly retryable: boolean

  constructor(code: string, message?: string, options: { retryable?: boolean } = {}) {
    super(message ?? code)
    this.code = code
    this.retryable = options.retryable ?? true
  }
}

const CHANNEL_ID_PATTERN = /^[a-z][a-z0-9-]{1,62}$/

export function validateChannelManifest(channels: readonly NotificationChannel[]): readonly NotificationChannel[] {
  const seen = new Set<string>()
  for (const channel of channels) {
    if (!CHANNEL_ID_PATTERN.test(channel.id)) {
      throw new Error(`Invalid notification channel id "${channel.id}": must match ${CHANNEL_ID_PATTERN}`)
    }
    if (channel.apiVersion !== 1) {
      throw new Error(`Notification channel "${channel.id}" declares apiVersion ${channel.apiVersion}; host supports 1`)
    }
    if (channel.id !== channel.channel) {
      throw new Error(`Notification channel "${channel.id}" must deliver its own channel id`)
    }
    if (seen.has(channel.id)) throw new Error(`Duplicate notification channel id "${channel.id}"`)
    seen.add(channel.id)
  }
  return channels
}
