import { sql } from 'drizzle-orm'
import { check, index, integer, pgEnum, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core'
import { apikey, user } from './auth'
import { createdAt, updatedAt } from './columns'

export const appRole = pgEnum('app_role', ['admin', 'member'])

// One tenant = one consuming site (last-comments, another product). The public `key` is what callers
// put in the URL; it is not a secret.
export const apps = pgTable('apps', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

// Every app-owned table references apps through this column, so the cascade is the same everywhere.
export const appRef = () =>
  uuid('app_id')
    .notNull()
    .references(() => apps.id, { onDelete: 'cascade' })

// Browser origins allowed to read auth responses and stream notifications.
export const appOrigins = pgTable(
  'app_origins',
  {
    appId: appRef(),
    origin: text('origin').notNull(),
  },
  (table) => [primaryKey({ columns: [table.appId, table.origin] })],
)

export const appMemberships = pgTable(
  'app_memberships',
  {
    appId: appRef(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: appRole('role').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.appId, table.userId] }),
    index('app_memberships_user_id_idx').on(table.userId),
  ],
)

// The one app a bound API key belongs to. Cascades with the app, and a binding is one indexed read.
export const apiKeyApps = pgTable(
  'api_key_apps',
  {
    apiKeyId: text('api_key_id')
      .primaryKey()
      .references(() => apikey.id, { onDelete: 'cascade' }),
    appId: appRef(),
    createdAt: createdAt(),
  },
  (table) => [index('api_key_apps_app_id_idx').on(table.appId)],
)

// Singleton: slot is always 1, so at most one instance admin exists. Written by admin-repository under an advisory lock.
export const instanceAdmins = pgTable(
  'instance_admins',
  {
    slot: integer('slot').primaryKey().default(1),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (table) => [check('instance_admins_singleton_check', sql`${table.slot} = 1`)],
)
