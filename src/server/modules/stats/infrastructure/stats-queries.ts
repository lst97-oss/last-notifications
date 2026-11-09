import { and, asc, count, desc, eq, gte, inArray, min, sql } from 'drizzle-orm'

import { type BusinessDb, getBusinessDb } from '@/server/db/business-sql'
import { appOrigins, apps, notificationDeliveries, notifications } from '@/server/db/schema'
import { ErrorCode, HttpError } from '@/server/http/errors'

export type StatsWindow = { days: number; start: string; published: number; delivered: number; deadLetter: number }

export type StatsSeriesPoint = {
  day: string
  published: number
  read: number
  delivered: number
  deadLetter: number
  pending: number
}

export type ChannelBreakdown = { channel: string; delivered: number; deadLetter: number }

export type AppDashboardStats = {
  totals: {
    published: number
    read: number
    recipients: number
    delivered: number
    deadLetter: number
    pending: number
    processing: number
  }
  window: StatsWindow
  series: StatsSeriesPoint[]
  byChannel: ChannelBreakdown[]
  topTypes: { type: string; total: number }[]
  topRecipients: { recipientKey: string; total: number }[]
}

export type FleetDashboardStats = AppDashboardStats & {
  topApps: { appKey: string; appName: string; total: number }[]
}

export type AppDetail = {
  app: { id: string; key: string; name: string; origin: string | null; createdAt: string }
  stats: AppDashboardStats
}

export type StatsRange = 7 | 30 | 90 | 'all'

// UTC midnight of the first day in the window; the series spine uses the same
// boundary so every aggregate lines up with the chart.
function windowStart(days: number): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)))
}

// `all` starts at the scope's first notification; with none, it is today alone.
async function rangeStart(range: StatsRange, appFilter: ReturnType<typeof sql>, db: BusinessDb): Promise<Date> {
  if (range !== 'all') return windowStart(range)
  const [first] = await db
    .select({ createdAt: min(notifications.createdAt) })
    .from(notifications)
    .where(appFilter)
  const day = first?.createdAt ?? new Date()
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()))
}

// An app with nothing to aggregate still gets a full spine, so charts render
// zeros instead of an empty axis.
function zeroedSeries(days: number): StatsSeriesPoint[] {
  const start = windowStart(days)
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(start.getTime() + index * 86_400_000)
    return {
      day: day.toISOString().slice(0, 10),
      published: 0,
      read: 0,
      delivered: 0,
      deadLetter: 0,
      pending: 0,
    }
  })
}

function summarise(series: StatsSeriesPoint[]): StatsWindow {
  return {
    days: series.length,
    start: series[0]?.day ?? '',
    published: series.reduce((sum, row) => sum + row.published, 0),
    delivered: series.reduce((sum, row) => sum + row.delivered, 0),
    deadLetter: series.reduce((sum, row) => sum + row.deadLetter, 0),
  }
}

type ScopeTotals = Omit<AppDashboardStats, 'window' | 'series' | 'byChannel' | 'topTypes' | 'topRecipients'>

// One tenant's totals: the inbox is the published notification, the outbox rows
// are the async fan-out. inapp never has a delivery row, so the pie counts only
// email/webpush and can read lower than `published` — that is expected.
async function readTotals(appFilter: ReturnType<typeof sql>, db: BusinessDb): Promise<ScopeTotals> {
  const [publishedRows, deliveryRows] = await Promise.all([
    db
      .select({
        published: count(),
        read: sql<number>`count(*) filter (where ${notifications.readAt} is not null)`,
        recipients: sql<number>`count(distinct ${notifications.recipientKey})`,
      })
      .from(notifications)
      .where(appFilter),
    db
      .select({
        delivered: sql<number>`count(*) filter (where ${notificationDeliveries.status} = 'delivered')`,
        deadLetter: sql<number>`count(*) filter (where ${notificationDeliveries.status} = 'dead_letter')`,
        pending: sql<number>`count(*) filter (where ${notificationDeliveries.status} = 'pending')`,
        processing: sql<number>`count(*) filter (where ${notificationDeliveries.status} = 'processing')`,
      })
      .from(notificationDeliveries)
      .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
      .where(appFilter),
  ])
  const published = publishedRows[0]
  const delivery = deliveryRows[0]
  return {
    totals: {
      published: Number(published?.published ?? 0),
      read: Number(published?.read ?? 0),
      recipients: Number(published?.recipients ?? 0),
      delivered: Number(delivery?.delivered ?? 0),
      deadLetter: Number(delivery?.deadLetter ?? 0),
      pending: Number(delivery?.pending ?? 0),
      processing: Number(delivery?.processing ?? 0),
    },
  }
}

// The day spine plus per-day notification and delivery counts. `appFilter` is
// written against the unaliased `notifications` table so it can be embedded in
// both the outer query and the CTEs.
async function readSeries(appFilter: ReturnType<typeof sql>, start: Date, db: BusinessDb): Promise<StatsSeriesPoint[]> {
  const rows = await db.execute<{
    day: string
    published: number
    read: number
    delivered: number
    deadLetter: number
    pending: number
  }>(
    sql`
    with days as (
      select generate_series(
        ${start},
        date_trunc('day', now()),
        interval '1 day'
      ) as day
    ),
    notification_days as (
      select date_trunc('day', notifications.created_at) as day,
        count(*)::int as published,
        count(*) filter (where notifications.read_at is not null)::int as read
      from notifications
      where ${appFilter} and notifications.created_at >= (select min(day) from days)
      group by 1
    ),
    delivery_days as (
      select date_trunc('day', notifications.created_at) as day,
        count(*) filter (where notification_deliveries.status = 'delivered')::int as delivered,
        count(*) filter (where notification_deliveries.status = 'dead_letter')::int as "deadLetter",
        count(*) filter (where notification_deliveries.status in ('pending', 'processing'))::int as pending
      from notification_deliveries
      join notifications on notifications.id = notification_deliveries.notification_id
      where ${appFilter} and notifications.created_at >= (select min(day) from days)
      group by 1
    )
    select to_char(days.day, 'YYYY-MM-DD') as day,
      coalesce(notification_days.published, 0)::int as published,
      coalesce(notification_days.read, 0)::int as read,
      coalesce(delivery_days.delivered, 0)::int as delivered,
      coalesce(delivery_days."deadLetter", 0)::int as "deadLetter",
      coalesce(delivery_days.pending, 0)::int as pending
    from days
    left join notification_days on notification_days.day = days.day
    left join delivery_days on delivery_days.day = days.day
    order by days.day
  `,
  )
  return rows.map((row) => ({
    day: row.day,
    published: Number(row.published),
    read: Number(row.read),
    delivered: Number(row.delivered),
    deadLetter: Number(row.deadLetter),
    pending: Number(row.pending),
  }))
}

async function readBreakdowns(
  appFilter: ReturnType<typeof sql>,
  start: Date,
  db: BusinessDb,
): Promise<Pick<AppDashboardStats, 'byChannel' | 'topTypes' | 'topRecipients'>> {
  const [channelRows, typeRows, recipientRows] = await Promise.all([
    db
      .select({
        channel: notificationDeliveries.channel,
        delivered: sql<number>`count(*) filter (where ${notificationDeliveries.status} = 'delivered')`,
        deadLetter: sql<number>`count(*) filter (where ${notificationDeliveries.status} = 'dead_letter')`,
      })
      .from(notificationDeliveries)
      .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
      .where(and(appFilter, gte(notifications.createdAt, start)))
      .groupBy(notificationDeliveries.channel),
    db
      .select({ type: notifications.type, total: count(notifications.id) })
      .from(notifications)
      .where(and(appFilter, gte(notifications.createdAt, start)))
      .groupBy(notifications.type)
      .orderBy(desc(count(notifications.id)))
      .limit(5),
    db
      .select({ recipientKey: notifications.recipientKey, total: count(notifications.id) })
      .from(notifications)
      .where(and(appFilter, gte(notifications.createdAt, start)))
      .groupBy(notifications.recipientKey)
      .orderBy(desc(count(notifications.id)))
      .limit(5),
  ])
  return {
    byChannel: channelRows.map((row) => ({
      channel: row.channel,
      delivered: Number(row.delivered),
      deadLetter: Number(row.deadLetter),
    })),
    topTypes: typeRows.map((row) => ({ type: row.type, total: Number(row.total) })),
    topRecipients: recipientRows.map((row) => ({ recipientKey: row.recipientKey, total: Number(row.total) })),
  }
}

export async function getAppStats(
  appId: string,
  range: StatsRange,
  db: BusinessDb = getBusinessDb(),
): Promise<AppDashboardStats> {
  const appFilter = eq(notifications.appId, appId)
  const start = await rangeStart(range, appFilter, db)
  const [scope, series, breakdowns] = await Promise.all([
    readTotals(appFilter, db),
    readSeries(appFilter, start, db),
    readBreakdowns(appFilter, start, db),
  ])
  return { ...scope, ...breakdowns, window: summarise(series), series }
}

// `null` means the viewer administers every app (instance admin). An empty list
// is answered without a query so the dashboard never falls back to unfiltered
// counts for someone who can see nothing.
export async function getFleetStats(
  appIds: string[] | null,
  range: StatsRange,
  db: BusinessDb = getBusinessDb(),
): Promise<FleetDashboardStats> {
  if (appIds !== null && appIds.length === 0) {
    const series = zeroedSeries(range === 'all' ? 1 : range)
    return {
      totals: { published: 0, read: 0, recipients: 0, delivered: 0, deadLetter: 0, pending: 0, processing: 0 },
      window: summarise(series),
      series,
      byChannel: [],
      topTypes: [],
      topRecipients: [],
      topApps: [],
    }
  }

  const appFilter = appIds === null ? sql`true` : inArray(notifications.appId, appIds)
  const start = await rangeStart(range, appFilter, db)
  const [scope, series, breakdowns, topApps] = await Promise.all([
    readTotals(appFilter, db),
    readSeries(appFilter, start, db),
    readBreakdowns(appFilter, start, db),
    db
      .select({ appKey: apps.key, appName: apps.name, total: count(notifications.id) })
      .from(notifications)
      .innerJoin(apps, eq(apps.id, notifications.appId))
      .where(and(appFilter, gte(notifications.createdAt, start)))
      .groupBy(apps.id, apps.key, apps.name)
      .orderBy(desc(count(notifications.id)))
      .limit(5),
  ])
  return {
    ...scope,
    ...breakdowns,
    topApps: topApps.map((row) => ({ appKey: row.appKey, appName: row.appName, total: Number(row.total) })),
    window: summarise(series),
    series,
  }
}

// The app header the detail page shows above its stats. A missing app is a 404
// here rather than an empty payload, so the page cannot render a phantom tenant.
export async function getAppDetail(
  appId: string,
  range: StatsRange,
  db: BusinessDb = getBusinessDb(),
): Promise<AppDetail> {
  const [row] = await db
    .select({ id: apps.id, key: apps.key, name: apps.name, createdAt: apps.createdAt })
    .from(apps)
    .where(eq(apps.id, appId))
    .limit(1)
  if (!row) throw new HttpError(ErrorCode.APP_NOT_FOUND)

  const [origin] = await db
    .select({ origin: appOrigins.origin })
    .from(appOrigins)
    .where(eq(appOrigins.appId, appId))
    .orderBy(asc(appOrigins.origin))
    .limit(1)

  return {
    app: {
      id: row.id,
      key: row.key,
      name: row.name,
      origin: origin?.origin ?? null,
      createdAt: row.createdAt.toISOString(),
    },
    stats: await getAppStats(appId, range, db),
  }
}
