import { and, eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { appMemberships } from '@/server/db/schema'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'

// The dashboard is for admins: the instance admin, or an admin of at least one
// app. A signed-in account with no app role has no dashboard.
export async function hasDashboardAccess(userId: string): Promise<boolean> {
  if (await hasInstanceAdmin(userId)) return true
  const [row] = await getBusinessDb()
    .select({ appId: appMemberships.appId })
    .from(appMemberships)
    .where(and(eq(appMemberships.userId, userId), eq(appMemberships.role, 'admin')))
    .limit(1)
  return Boolean(row)
}
