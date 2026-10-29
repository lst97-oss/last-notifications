import { SQL } from 'bun'
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql'
import { drizzle } from 'drizzle-orm/bun-sql'

import { getBusinessEnv } from '@/server/config/business-env'
import * as schema from '@/server/db/schema'

// Lazy business Postgres client on Bun's native SQL driver — see AGENTS.md.
// Bun-only: never import from the Payload Node-CLI graph.

// node-postgres reads `sslmode=no-verify` as "TLS, skip certificate checks";
// Bun SQL rejects that value and spells the same mode `require`.
const NO_VERIFY_SSL_MODE = /([?&])sslmode=no-verify(?=&|#|$)/gi

export function toBunSqlUrl(connectionString: string): string {
  return connectionString.replace(NO_VERIFY_SSL_MODE, '$1sslmode=require')
}

let sql: SQL | null = null

export function getBusinessSql(): SQL {
  if (!sql) {
    // Bun keeps idle connections open forever; timeout keeps Postgres backends free.
    sql = new SQL(toBunSqlUrl(getBusinessEnv().connectionString), { idleTimeout: 60 })
  }
  return sql
}

export async function closeBusinessSql(): Promise<void> {
  if (!sql) return
  const closing = sql
  sql = null
  await closing.close()
}

export type BusinessDb = BunSQLDatabase<typeof schema>

export function getBusinessDb() {
  return drizzle(getBusinessSql(), { schema })
}
