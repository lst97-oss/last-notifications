import { count, eq } from 'drizzle-orm'

import { getBusinessDb, getBusinessSql } from '@/server/db/business-sql'
import { instanceAdmins, user } from '@/server/db/schema'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { canCreateInitialAdmin } from '@/server/modules/admin/domain/initial-setup'

export async function hasInstanceAdmin(userId?: string): Promise<boolean> {
  const rows = await getBusinessDb()
    .select({ userId: instanceAdmins.userId })
    .from(instanceAdmins)
    .where(userId ? eq(instanceAdmins.userId, userId) : undefined)
    .limit(1)
  return rows.length > 0
}

export async function isInitialAdminSetupAvailable(): Promise<boolean> {
  const db = getBusinessDb()
  const [users] = await db.select({ value: count() }).from(user)
  const [admins] = await db.select({ value: count() }).from(instanceAdmins)
  return canCreateInitialAdmin(users?.value ?? 0, admins?.value ?? 0)
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
