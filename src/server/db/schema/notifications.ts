import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { createdAtMs } from './columns'
import { recipientFk } from './recipients'

export const notificationDeliveryStatus = pgEnum('notification_delivery_status', [
  'pending',
  'processing',
  'delivered',
  'dead_letter',
])

// The inbox row is the in-app delivery. recipient_key is the consuming site's own opaque user id:
// end users never authenticate against this server. Channel names are checked by the zod enums and the
// plugin registry, not CHECK constraints, so adding a channel needs no migration.
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    appId: uuid('app_id').notNull(),
    recipientKey: text('recipient_key').notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    data: jsonb('data').notNull().default({}),
    priority: smallint('priority').notNull().default(0),
    dedupeKey: text('dedupe_key'),
    // Whether this notification targets the in-app surface; the inbox and bell read only these rows.
    inapp: boolean('inapp').notNull().default(true),
    readAt: timestamp('read_at', { withTimezone: true }),
    // Set when the recipient archives the row; archived rows leave the inbox and are purged 30 days later.
    archivedAt: timestamp('archived_at', { withTimezone: true, precision: 3 }),
    createdAt: createdAtMs(),
  },
  (table) => [
    check('notifications_priority_check', sql`${table.priority} between -2 and 2`),
    // Archiving always marks a row read, so an archived row is never unread.
    check('notifications_archived_read_check', sql`${table.archivedAt} is null or ${table.readAt} is not null`),
    recipientFk('notifications_recipient_fk', table),
    uniqueIndex('notifications_dedupe_uq')
      .on(table.appId, table.recipientKey, table.dedupeKey)
      .where(sql`${table.dedupeKey} is not null`),
    // The inbox pages (both views) and the recipient cascade.
    index('notifications_inbox_idx').on(table.appId, table.recipientKey, table.createdAt.desc(), table.id.desc()),
    // The archive view reads archived rows only, so it never walks the active inbox.
    index('notifications_archived_idx')
      .on(table.appId, table.recipientKey, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.archivedAt} is not null`),
    // Archive retention deletes by archive time across every app.
    index('notifications_archive_purge_idx')
      .on(table.archivedAt)
      .where(sql`${table.archivedAt} is not null`),
    // Email-only retention deletes by age.
    index('notifications_outbound_purge_idx')
      .on(table.createdAt)
      .where(sql`not ${table.inapp}`),
    // Dashboard windows filter one app by date; the inbox index cannot seek that without a recipient.
    index('notifications_app_created_idx').on(table.appId, table.createdAt),
  ],
)

// Transactional outbox: one row per async channel, written with the notification.
// inapp has no row — the inbox row itself is the delivery.
export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    status: notificationDeliveryStatus('status').notNull().default('pending'),
    // One-shot address from the publish request (email only). Cleared once delivered, and kept on
    // dead-letter so a requeue still sends to it.
    addressOverride: text('address_override'),
    attempts: integer('attempts').notNull().default(0),
    // Doubles as the lease: a claim moves it forward, so a crashed worker's rows come due again.
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).defaultNow().notNull(),
    lastError: text('last_error'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('notification_deliveries_notification_channel_uq').on(table.notificationId, table.channel),
    index('notification_deliveries_due_idx')
      .on(table.nextAttemptAt)
      .where(sql`${table.status} in ('pending', 'processing')`),
  ],
)
