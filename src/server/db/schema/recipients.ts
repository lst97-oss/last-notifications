import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { createdAt, updatedAt } from './columns'
import { appRef } from './tenancy'

// A recipient is the consuming site's opaque user id, scoped to one app. Every recipient-scoped row
// references this row, so deleting it removes that recipient everywhere. Publish, subscribe, contact,
// preference and token writes create it first (ensureRecipient), so no child row can be orphaned.
export const recipients = pgTable(
  'recipients',
  {
    appId: appRef(),
    recipientKey: text('recipient_key').notNull(),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.appId, table.recipientKey] })],
)

// Composite foreign key to recipients. The name is explicit so the identifier stays short of Postgres' 63-byte limit.
export function recipientFk(name: string, table: { appId: AnyPgColumn; recipientKey: AnyPgColumn }) {
  return foreignKey({
    name,
    columns: [table.appId, table.recipientKey],
    foreignColumns: [recipients.appId, recipients.recipientKey],
  }).onDelete('cascade')
}

// Where a channel can reach a recipient: an email address or a webhook URL.
export const recipientContacts = pgTable(
  'recipient_contacts',
  {
    appId: uuid('app_id').notNull(),
    recipientKey: text('recipient_key').notNull(),
    channel: text('channel').notNull(),
    address: text('address').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.appId, table.recipientKey, table.channel] }),
    recipientFk('recipient_contacts_recipient_fk', table),
  ],
)

// Absent row means enabled: opt-out only.
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    appId: uuid('app_id').notNull(),
    recipientKey: text('recipient_key').notNull(),
    channel: text('channel').notNull(),
    enabled: boolean('enabled').notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.appId, table.recipientKey, table.channel] }),
    recipientFk('notification_preferences_recipient_fk', table),
  ],
)

// Short-lived read-only browser credential, minted server-to-server so the app's publish key never
// reaches a browser. Only the sha256 hash is stored, and the hash is the key: every lookup is by hash.
export const recipientTokens = pgTable(
  'recipient_tokens',
  {
    tokenHash: text('token_hash').primaryKey(),
    appId: uuid('app_id').notNull(),
    recipientKey: text('recipient_key').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    recipientFk('recipient_tokens_recipient_fk', table),
    // The hourly purge deletes by expiry; without this index it scans the whole table.
    index('recipient_tokens_expires_idx').on(table.expiresAt),
    index('recipient_tokens_recipient_idx').on(table.appId, table.recipientKey),
  ],
)

// One row per browser install. The endpoint is unique within an app, so one tenant can never
// re-point another tenant's subscription.
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    appId: uuid('app_id').notNull(),
    recipientKey: text('recipient_key').notNull(),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    failureCount: integer('failure_count').notNull().default(0),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('push_subscriptions_app_endpoint_uq').on(table.appId, table.endpoint),
    index('push_subscriptions_recipient_idx').on(table.appId, table.recipientKey),
    // Pruning deletes endpoints that failed permanently, by failure time.
    index('push_subscriptions_failed_idx')
      .on(table.failedAt)
      .where(sql`${table.failedAt} is not null`),
    recipientFk('push_subscriptions_recipient_fk', table),
  ],
)
