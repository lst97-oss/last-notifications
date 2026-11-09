import { DEFAULT_CHANNELS, NOTIFICATION_CHANNELS, type NotificationChannelKind } from '@/server/db/vocabularies'
import { ErrorCode, HttpError } from '@/server/http/errors'

export type NotificationRecord = {
  id: string
  appId: string
  recipientKey: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  priority: number
  dedupeKey: string | null
  readAt: string | null
  archivedAt: string | null
  createdAt: string
}

// Archived notifications stay readable for this long, then the worker deletes them.
export const ARCHIVE_RETENTION_DAYS = 30
export const ARCHIVE_RETENTION_MS = ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000

export type InboxView = 'active' | 'archived'

export const INBOX_LIMIT_DEFAULT = 50
export const INBOX_LIMIT_MAX = 100
export const RECIPIENT_TOKEN_TTL_MS = 15 * 60_000

// Which channels this notification actually goes out on: the requested set
// (all three when omitted) minus channels the app disabled and channels the
// recipient opted out of. `inapp` needs no delivery row but still respects the
// same switches, because the inbox query filters on it.
export function resolveTargetChannels(input: {
  requested?: readonly string[]
  appChannels?: Readonly<Record<string, { enabled: boolean }>>
  preferences?: Readonly<Record<string, boolean>>
}): NotificationChannelKind[] {
  const requested = input.requested?.length ? input.requested : DEFAULT_CHANNELS
  return NOTIFICATION_CHANNELS.filter((channel) => {
    if (!requested.includes(channel)) return false
    if (input.appChannels?.[channel]?.enabled === false) return false
    if (input.preferences?.[channel] === false) return false
    return true
  })
}

// Opaque inbox cursor over (created_at, id) so keyset paging stays stable while
// rows are inserted. Encoded as base64url JSON, never parsed by clients.
export type InboxCursor = { t: string; i: string }

export function encodeCursor(cursor: InboxCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

export function decodeCursor(value: string): InboxCursor {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
  } catch {
    throw new HttpError(ErrorCode.VALIDATION_ERROR, 'since: cursor is not valid')
  }
  const cursor = parsed as Partial<InboxCursor> | null
  if (!cursor || typeof cursor.t !== 'string' || typeof cursor.i !== 'string' || Number.isNaN(Date.parse(cursor.t))) {
    throw new HttpError(ErrorCode.VALIDATION_ERROR, 'since: cursor is not valid')
  }
  return { t: cursor.t, i: cursor.i }
}

export function isNotificationChannelKind(value: string): value is NotificationChannelKind {
  return (NOTIFICATION_CHANNELS as readonly string[]).includes(value)
}
