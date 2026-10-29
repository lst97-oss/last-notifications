import { boolean, jsonb, pgTable, primaryKey, text } from 'drizzle-orm/pg-core'

import { updatedAt } from './columns'
import { appRef } from './tenancy'

// Per-app channel switch + non-secret tuning. Absent row = enabled with defaults.
// `signing_secret_encrypted` holds a sealed per-app secret (see security/secret-box.ts). It is a
// column of its own so no listing that reads `config` can ever return it.
export const appChannels = pgTable(
  'app_channels',
  {
    appId: appRef(),
    channel: text('channel').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    config: jsonb('config').notNull().default({}),
    signingSecretEncrypted: text('signing_secret_encrypted'),
    updatedAt: updatedAt(),
  },
  (table) => [primaryKey({ columns: [table.appId, table.channel] })],
)
