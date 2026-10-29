import { migrate } from 'drizzle-orm/bun-sql/migrator'

import { closeBusinessSql, getBusinessDb } from '@/server/db/business-sql'
import { getNotificationChannels } from '@/server/plugins/config'

try {
  const db = getBusinessDb()
  await migrate(db, { migrationsFolder: 'drizzle/business' })
  for (const channel of getNotificationChannels()) {
    if (channel.migrations) {
      await migrate(db, {
        migrationsFolder: channel.migrations.folder,
        migrationsSchema: channel.migrations.schema,
      })
    }
  }
} finally {
  await closeBusinessSql()
}
