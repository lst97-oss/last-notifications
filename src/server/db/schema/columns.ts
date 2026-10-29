import { timestamp } from 'drizzle-orm/pg-core'

export const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull()

// Millisecond precision: the inbox cursor is an ISO string, so microseconds would not round-trip and the
// boundary row would be served twice.
export const createdAtMs = () => timestamp('created_at', { withTimezone: true, precision: 3 }).defaultNow().notNull()

// Every updated_at moves on any drizzle update, so no write sets it by hand.
export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
