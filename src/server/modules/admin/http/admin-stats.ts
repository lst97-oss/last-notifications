import { getBusinessDb } from '@/server/db/business-sql'
import { apps } from '@/server/db/schema'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { ok } from '@/server/http/response'
import { isAppAdmin } from '@/server/http/route-guards'
import { parseSearchParams } from '@/server/http/validation'
import { statsQuerySchema } from '@/server/modules/admin/http/admin-schemas'
import { requireDashboardUser } from '@/server/modules/admin/http/dashboard-guard'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'
import { getAppId } from '@/server/modules/apps/infrastructure/app-repository'
import { getAppDetail, getFleetStats } from '@/server/modules/stats/infrastructure/stats-queries'

// null means "every app" (instance admin). Otherwise only the apps this account
// administers, so an app admin can never read another tenant's numbers.
async function visibleAppIds(userId: string): Promise<string[] | null> {
  if (await hasInstanceAdmin(userId)) return null
  const rows = await getBusinessDb().select({ appId: apps.id }).from(apps)
  const allowed: string[] = []
  for (const row of rows) {
    if (await isAppAdmin(row.appId, userId)) allowed.push(row.appId)
  }
  return allowed
}

// Reads take no same-origin check: browsers omit Origin on same-origin GET.
export async function getAppStatsData(request: Request, appKey: string): Promise<Response> {
  const userId = await requireDashboardUser(request, 'Sign in to view app stats')
  const { days } = parseSearchParams(request.url, statsQuerySchema)
  const appId = await getAppId(appKey)
  if (!appId) throw new HttpError(ErrorCode.APP_NOT_FOUND)

  const allowed = await visibleAppIds(userId)
  if (allowed && !allowed.includes(appId)) {
    throw new HttpError(ErrorCode.FORBIDDEN, 'Only an admin of this app can view its stats')
  }
  return ok({ detail: await getAppDetail(appId, days) })
}

export async function getFleetStatsData(request: Request): Promise<Response> {
  const userId = await requireDashboardUser(request, 'Sign in to view dashboard stats')
  const { days } = parseSearchParams(request.url, statsQuerySchema)
  return ok({ stats: await getFleetStats(await visibleAppIds(userId), days) })
}
