import { eq } from 'drizzle-orm'

import { type BusinessDb, getBusinessDb, getBusinessSql } from '@/server/db/business-sql'
import { instanceAdmins, user } from '@/server/db/schema'
import { ErrorCode, HttpError } from '@/server/http/errors'

// True only when an instance admin row points at an account that exists in the user table.
export async function hasInstanceAdmin(userId?: string, db: BusinessDb = getBusinessDb()): Promise<boolean> {
  const rows = await db
    .select({ userId: instanceAdmins.userId })
    .from(instanceAdmins)
    .innerJoin(user, eq(user.id, instanceAdmins.userId))
    .where(userId ? eq(instanceAdmins.userId, userId) : undefined)
    .limit(1)
  return rows.length > 0
}

// Setup stays open until an admin account exists. A user row alone does not close it: an account that never
// became admin would lock the instance.
export async function isInitialAdminSetupAvailable(db: BusinessDb = getBusinessDb()): Promise<boolean> {
  return !(await hasInstanceAdmin(undefined, db))
}

// Makes an existing account the instance admin. The slot is a singleton, so a second grant does nothing.
export async function grantInstanceAdmin(userId: string, db: BusinessDb = getBusinessDb()): Promise<void> {
  await db.insert(instanceAdmins).values({ slot: 1, userId }).onConflictDoNothing()
}

export async function createInitialAdmin<T extends { userId: string }>(createUser: () => Promise<T>): Promise<T> {
  const sql = getBusinessSql()
  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(736942185)`
    if (!(await isInitialAdminSetupAvailable())) {
      throw new HttpError(ErrorCode.SETUP_UNAVAILABLE)
    }
    const result = await createUser()
    await tx`INSERT INTO instance_admins (slot, user_id) VALUES (1, ${result.userId})`
    return result
  })
}
