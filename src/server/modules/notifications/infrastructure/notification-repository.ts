import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'

import { type BusinessDb, getBusinessDb } from '@/server/db/business-sql'
import {
  appChannels,
  notificationDeliveries,
  notificationPreferences,
  notifications,
  recipientContacts,
  recipients,
} from '@/server/db/schema'
import type { ContactChannelKind, NotificationChannelKind } from '@/server/db/vocabularies'
import {
  ARCHIVE_RETENTION_MS,
  decodeCursor,
  encodeCursor,
  INBOX_LIMIT_DEFAULT,
  INBOX_LIMIT_MAX,
  type InboxView,
  type NotificationRecord,
} from '@/server/modules/notifications/domain/notification'

type NotificationRow = typeof notifications.$inferSelect

// Every recipient-scoped write runs this first, in the same transaction, so the composite foreign keys
// always find their recipient. Idempotent, so a repeated publish or subscribe is a no-op here.
export async function ensureRecipient(db: BusinessDb, input: { appId: string; recipientKey: string }): Promise<void> {
  await db.insert(recipients).values({ appId: input.appId, recipientKey: input.recipientKey }).onConflictDoNothing()
}

function toRecord(row: NotificationRow): NotificationRecord {
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

export type InsertNotificationInput = {
  appId: string
  recipientKey: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  priority: number
  dedupeKey: string | null
  inapp: boolean
}

// Insert-or-find: the dedupe unique index makes a retried publish idempotent.
export async function insertNotification(
  tx: BusinessDb,
  input: InsertNotificationInput,
): Promise<{ record: NotificationRecord; duplicate: boolean }> {
  const [inserted] = await tx.insert(notifications).values(input).onConflictDoNothing().returning()

  if (inserted) return { record: toRecord(inserted), duplicate: false }

  // Conflict only happens on the dedupe index; the same publish already landed.
  const [existing] = await tx
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.appId, input.appId),
        eq(notifications.recipientKey, input.recipientKey),
        eq(notifications.dedupeKey, input.dedupeKey ?? ''),
      ),
    )
    .limit(1)
  if (!existing) throw new Error('NOTIFICATION_DEDUPE_RACE')
  return { record: toRecord(existing), duplicate: true }
}

export async function insertDeliveries(
  tx: BusinessDb,
  notificationId: string,
  channels: readonly NotificationChannelKind[],
  addressOverride?: string,
): Promise<void> {
  if (channels.length === 0) return
  await tx
    .insert(notificationDeliveries)
    .values(
      channels.map((channel) => ({
        notificationId,
        channel,
        addressOverride: channel === 'email' ? (addressOverride ?? null) : null,
      })),
    )
    .onConflictDoNothing()
}

export async function getNotificationById(
  notificationId: string,
  db: BusinessDb = getBusinessDb(),
): Promise<NotificationRecord | null> {
  const [row] = await db.select().from(notifications).where(eq(notifications.id, notificationId)).limit(1)
  return row ? toRecord(row) : null
}

// Per-app switches and per-recipient opt-outs, as plain maps for the resolver.
export async function loadChannelContext(
  appId: string,
  recipientKey: string,
  db: BusinessDb = getBusinessDb(),
): Promise<{
  appChannels: Record<string, { enabled: boolean }>
  preferences: Record<string, boolean>
}> {
  const [channelRows, preferenceRows] = await Promise.all([
    db
      .select({ channel: appChannels.channel, enabled: appChannels.enabled })
      .from(appChannels)
      .where(eq(appChannels.appId, appId)),
    db
      .select({ channel: notificationPreferences.channel, enabled: notificationPreferences.enabled })
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.appId, appId), eq(notificationPreferences.recipientKey, recipientKey))),
  ])
  return {
    appChannels: Object.fromEntries(channelRows.map((row) => [row.channel, { enabled: row.enabled }])),
    preferences: Object.fromEntries(preferenceRows.map((row) => [row.channel, row.enabled])),
  }
}

// Only in-app rows are inbox items. Ascending keyset page by default (`next` is the
// cursor to pass back as `since`); `order: 'desc'` returns the newest page.
// The inbox is the active rows; the archive is archived rows still inside the retention window.
function viewScope(view: InboxView, now: Date) {
  if (view === 'archived') {
    return and(
      isNotNull(notifications.archivedAt),
      gt(notifications.archivedAt, new Date(now.getTime() - ARCHIVE_RETENTION_MS)),
    )
  }
  return isNull(notifications.archivedAt)
}

// Keyset pages over (created_at, id). `since` pages forward (oldest first, for catch-up); `before` pages back
// (newest first, for the bell). `next` is the cursor to pass back, or null on the last page.
export async function listInboxItems(
  input: {
    appId: string
    recipientKey: string
    since?: string
    before?: string
    limit?: number
    order?: 'asc' | 'desc'
    view?: InboxView
    now?: Date
  },
  db: BusinessDb = getBusinessDb(),
): Promise<{ items: NotificationRecord[]; next: string | null }> {
  const limit = Math.min(Math.max(input.limit ?? INBOX_LIMIT_DEFAULT, 1), INBOX_LIMIT_MAX)
  const scope = and(
    eq(notifications.appId, input.appId),
    eq(notifications.recipientKey, input.recipientKey),
    eq(notifications.inapp, true),
    viewScope(input.view ?? 'active', input.now ?? new Date()),
  )

  if (input.order === 'desc') {
    const cursor = input.before ? decodeCursor(input.before) : null
    const rows = await db
      .select()
      .from(notifications)
      .where(
        and(
          scope,
          cursor
            ? or(
                lt(notifications.createdAt, new Date(cursor.t)),
                and(eq(notifications.createdAt, new Date(cursor.t)), lt(notifications.id, cursor.i)),
              )
            : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit + 1)
    const page = rows.slice(0, limit).map(toRecord)
    const last = page.at(-1)
    return { items: page, next: rows.length > limit && last ? encodeCursor({ t: last.createdAt, i: last.id }) : null }
  }

  const cursor = input.since ? decodeCursor(input.since) : null
  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        scope,
        cursor
          ? or(
              gt(notifications.createdAt, new Date(cursor.t)),
              and(eq(notifications.createdAt, new Date(cursor.t)), gt(notifications.id, cursor.i)),
            )
          : undefined,
      ),
    )
    .orderBy(asc(notifications.createdAt), asc(notifications.id))
    .limit(limit + 1)

  const page = rows.slice(0, limit).map(toRecord)
  const last = page.at(-1)
  return {
    items: page,
    next: rows.length > limit && last ? encodeCursor({ t: last.createdAt, i: last.id }) : null,
  }
}

// `total` is every row in the inbox (the header count); `unread` drives the badge. Archived rows never count.
export async function countInbox(
  input: { appId: string; recipientKey: string },
  db: BusinessDb = getBusinessDb(),
): Promise<{ total: number; unread: number }> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      unread: sql<number>`count(*) filter (where ${notifications.readAt} is null)::int`,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.appId, input.appId),
        eq(notifications.recipientKey, input.recipientKey),
        eq(notifications.inapp, true),
        isNull(notifications.archivedAt),
      ),
    )
  return { total: row?.total ?? 0, unread: row?.unread ?? 0 }
}

// Archiving marks the row read, so an archived row is never unread. `read: true` archives every row already read.
export async function archiveNotifications(
  input: { appId: string; recipientKey: string; ids?: string[]; read?: boolean },
  db: BusinessDb = getBusinessDb(),
): Promise<number> {
  const updated = await db
    .update(notifications)
    .set({ archivedAt: sql`now()`, readAt: sql`coalesce(${notifications.readAt}, now())` })
    .where(
      and(
        eq(notifications.appId, input.appId),
        eq(notifications.recipientKey, input.recipientKey),
        eq(notifications.inapp, true),
        isNull(notifications.archivedAt),
        input.read ? isNotNull(notifications.readAt) : inArray(notifications.id, input.ids ?? []),
      ),
    )
    .returning({ id: notifications.id })
  return updated.length
}

// Moves archived rows back to the inbox. Their read state is kept.
export async function restoreNotifications(
  input: { appId: string; recipientKey: string; ids: string[] },
  db: BusinessDb = getBusinessDb(),
): Promise<number> {
  const updated = await db
    .update(notifications)
    .set({ archivedAt: null })
    .where(
      and(
        eq(notifications.appId, input.appId),
        eq(notifications.recipientKey, input.recipientKey),
        eq(notifications.inapp, true),
        isNotNull(notifications.archivedAt),
        inArray(notifications.id, input.ids),
      ),
    )
    .returning({ id: notifications.id })
  return updated.length
}

// Retention: archived rows older than the window are deleted. The worker's hourly pass calls this.
export async function purgeArchivedNotifications(
  db: BusinessDb = getBusinessDb(),
  now: Date = new Date(),
): Promise<number> {
  const removed = await db
    .delete(notifications)
    .where(
      and(
        isNotNull(notifications.archivedAt),
        lt(notifications.archivedAt, new Date(now.getTime() - ARCHIVE_RETENTION_MS)),
      ),
    )
    .returning({ id: notifications.id })
  return removed.length
}

export async function markNotificationsRead(
  input: { appId: string; recipientKey: string; ids?: string[]; all?: boolean },
  db: BusinessDb = getBusinessDb(),
): Promise<number> {
  const scope = and(
    eq(notifications.appId, input.appId),
    eq(notifications.recipientKey, input.recipientKey),
    isNull(notifications.readAt),
    input.all ? undefined : inArray(notifications.id, input.ids ?? []),
  )
  const updated = await db
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(scope)
    .returning({ id: notifications.id })
  return updated.length
}

export async function deleteNotification(
  input: { appId: string; recipientKey: string; id: string },
  db: BusinessDb = getBusinessDb(),
): Promise<boolean> {
  const removed = await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.id, input.id),
        eq(notifications.appId, input.appId),
        eq(notifications.recipientKey, input.recipientKey),
      ),
    )
    .returning({ id: notifications.id })
  return removed.length > 0
}

export async function setRecipientChannelAddress(
  input: { appId: string; recipientKey: string; channel: ContactChannelKind; address: string },
  db: BusinessDb = getBusinessDb(),
): Promise<void> {
  await db.transaction(async (tx) => {
    await ensureRecipient(tx, input)
    await tx
      .insert(recipientContacts)
      .values(input)
      .onConflictDoUpdate({
        target: [recipientContacts.appId, recipientContacts.recipientKey, recipientContacts.channel],
        set: { address: input.address },
      })
  })
}

export async function getRecipientChannelAddress(
  input: { appId: string; recipientKey: string; channel: ContactChannelKind },
  db: BusinessDb = getBusinessDb(),
): Promise<string | null> {
  const [row] = await db
    .select({ address: recipientContacts.address })
    .from(recipientContacts)
    .where(
      and(
        eq(recipientContacts.appId, input.appId),
        eq(recipientContacts.recipientKey, input.recipientKey),
        eq(recipientContacts.channel, input.channel),
      ),
    )
    .limit(1)
  return row?.address ?? null
}

export async function setChannelPreference(
  input: { appId: string; recipientKey: string; channel: NotificationChannelKind; enabled: boolean },
  db: BusinessDb = getBusinessDb(),
): Promise<void> {
  await db.transaction(async (tx) => {
    await ensureRecipient(tx, input)
    await tx
      .insert(notificationPreferences)
      .values(input)
      .onConflictDoUpdate({
        target: [notificationPreferences.appId, notificationPreferences.recipientKey, notificationPreferences.channel],
        set: { enabled: input.enabled },
      })
  })
}

export async function getChannelPreferences(
  input: { appId: string; recipientKey: string },
  db: BusinessDb = getBusinessDb(),
): Promise<Record<string, boolean>> {
  const rows = await db
    .select({ channel: notificationPreferences.channel, enabled: notificationPreferences.enabled })
    .from(notificationPreferences)
    .where(
      and(eq(notificationPreferences.appId, input.appId), eq(notificationPreferences.recipientKey, input.recipientKey)),
    )
  return Object.fromEntries(rows.map((row) => [row.channel, row.enabled]))
}
