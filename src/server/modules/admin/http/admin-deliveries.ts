import { and, count, desc, eq, inArray } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { apps, notificationDeliveries, notifications } from '@/server/db/schema'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { ok } from '@/server/http/response'
import { assertSameOrigin, isAppAdmin } from '@/server/http/route-guards'
import { parseSearchParams, parseWith } from '@/server/http/validation'
import { deliveriesQuerySchema, deliveryIdSchema } from '@/server/modules/admin/http/admin-schemas'
import { requireDashboardUser } from '@/server/modules/admin/http/dashboard-guard'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'
import { getAppId } from '@/server/modules/apps/infrastructure/app-repository'
import { requeueDeadLetter } from '@/server/plugins/channel-delivery'

// null means "every app" (instance admin). Otherwise only the apps this account
// administers, so an app admin can never read another tenant's failures.
async function visibleAppIds(userId: string): Promise<string[] | null> {
  if (await hasInstanceAdmin(userId)) return null
  const rows = await getBusinessDb().select({ appId: apps.id }).from(apps)
  const allowed: string[] = []
  for (const row of rows) {
    if (await isAppAdmin(row.appId, userId)) allowed.push(row.appId)
  }
  return allowed
}

// Delivery inspection is read-only and role-scoped. A dead letter is the reason
// this exists, so the failure code and attempt count travel with the row.
export async function listDeliveriesData(request: Request): Promise<Response> {
  const userId = await requireDashboardUser(request, 'Sign in to inspect deliveries')
  const query = parseSearchParams(request.url, deliveriesQuerySchema)
  const allowed = await visibleAppIds(userId)
  const appId = query.appKey ? await getAppId(query.appKey) : null
  if (query.appKey && !appId) throw new HttpError(ErrorCode.APP_NOT_FOUND)
  if (appId && allowed && !allowed.includes(appId)) {
    throw new HttpError(ErrorCode.FORBIDDEN, 'Only an admin of this app can inspect its deliveries')
  }

  const db = getBusinessDb()
  const filters = and(
    appId ? eq(notifications.appId, appId) : undefined,
    allowed ? inArray(notifications.appId, allowed) : undefined,
    query.channel ? eq(notificationDeliveries.channel, query.channel) : undefined,
    query.status ? eq(notificationDeliveries.status, query.status) : undefined,
  )

  const [totalRow] = await db
    .select({ value: count() })
    .from(notificationDeliveries)
    .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
    .innerJoin(apps, eq(apps.id, notifications.appId))
    .where(filters)

  const rows = await db
    .select({
      id: notificationDeliveries.id,
      channel: notificationDeliveries.channel,
      status: notificationDeliveries.status,
      attempts: notificationDeliveries.attempts,
      lastError: notificationDeliveries.lastError,
      deliveredAt: notificationDeliveries.deliveredAt,
      notificationId: notifications.id,
      title: notifications.title,
      recipientKey: notifications.recipientKey,
      appKey: apps.key,
      createdAt: notifications.createdAt,
    })
    .from(notificationDeliveries)
    .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
    .innerJoin(apps, eq(apps.id, notifications.appId))
    .where(filters)
    // id breaks ties so a page boundary never repeats or skips a row.
    .orderBy(desc(notificationDeliveries.nextAttemptAt), desc(notificationDeliveries.id))
    .limit(query.limit)
    .offset(query.offset)
  return ok({ deliveries: rows, total: Number(totalRow?.value ?? 0), limit: query.limit, offset: query.offset })
}

export async function retryDeliveryData(request: Request, params: { id: string }): Promise<Response> {
  assertSameOrigin(request, 'Delivery retries must use the application origin')
  const userId = await requireDashboardUser(request, 'Sign in to inspect deliveries')
  const deliveryId = parseWith(deliveryIdSchema, params.id)
  const [row] = await getBusinessDb()
    .select({ appId: notifications.appId })
    .from(notificationDeliveries)
    .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
    .where(eq(notificationDeliveries.id, deliveryId))
    .limit(1)
  if (!row) throw new HttpError(ErrorCode.DELIVERY_NOT_FOUND)
  const allowed = await visibleAppIds(userId)
  if (allowed && !allowed.includes(row.appId)) {
    throw new HttpError(ErrorCode.FORBIDDEN, 'Only an admin of this app can retry its deliveries')
  }
  // Only a dead letter goes back to the queue: the operator decided the cause is fixed.
  if (!(await requeueDeadLetter(getBusinessDb(), deliveryId))) throw new HttpError(ErrorCode.DELIVERY_NOT_RETRYABLE)
  return ok({ retried: true })
}
