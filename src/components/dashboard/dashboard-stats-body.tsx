'use client'

import { Link } from '@tanstack/react-router'
import { Leaderboard } from '@/components/dashboard/leaderboard'
import {
  ChannelActivityPanel,
  DeliveryStatusPie,
  NotificationActivityPanel,
  ReadRatePanel,
  StatCard,
  type StatsSeriesPoint,
} from '@/components/dashboard/stats-panels'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'

// Wire mirror of AppDashboardStats; dates already cross the wire as strings.
export type DashboardStats = {
  totals: {
    published: number
    read: number
    recipients: number
    delivered: number
    deadLetter: number
    pending: number
    processing: number
  }
  window: { days: number; start: string; published: number; delivered: number; deadLetter: number }
  series: StatsSeriesPoint[]
  byChannel: { channel: string; delivered: number; deadLetter: number }[]
  topTypes: { type: string; total: number }[]
  topRecipients: { recipientKey: string; total: number }[]
}

// The stat cards, trends, and breakdowns both dashboard screens share. The
// fleet page adds its Top apps card beside these; the per-app page adds its own
// leaderboards — everything below is already scoped by whichever endpoint fed it.
export function DashboardStatsBody({
  stats,
  days,
  breakdown,
}: {
  stats: DashboardStats
  days: number
  // The third cell between Channels and Read rate: a fleet fills it with Top
  // apps, one app with its own type/recipient leaderboards.
  breakdown?: React.ReactNode
}) {
  const { totals, window: windowStats } = stats
  const unread = Math.max(0, totals.published - totals.read)

  return (
    <>
      <section aria-label="Summary" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Notifications published"
          description="Every notification in scope"
          value={totals.published.toLocaleString()}
          footnote={`+${windowStats.published.toLocaleString()} in the last ${days} days`}
        />
        <StatCard
          title="Deliveries finished"
          description="Async channels that reached an endpoint"
          value={totals.delivered.toLocaleString()}
          footnote={`${totals.deadLetter.toLocaleString()} dead letters`}
        />
        <StatCard
          title="Recipients"
          description="Distinct recipient keys"
          value={totals.recipients.toLocaleString()}
          footnote={`${totals.pending.toLocaleString()} deliveries pending`}
        />
        <StatCard
          title="Unread"
          description="Notifications nobody opened yet"
          value={unread.toLocaleString()}
          footnote={`${totals.read.toLocaleString()} of ${totals.published.toLocaleString()} read`}
        />
      </section>

      <section aria-label="Trends" className="grid gap-4 lg:grid-cols-3">
        <NotificationActivityPanel
          className="lg:col-span-2"
          days={days}
          windowPublished={windowStats.published}
          series={stats.series}
        />
        <DeliveryStatusPie
          totals={totals}
          emptyTitle="No deliveries yet"
          emptyDescription="Email and Web Push rows appear here as soon as a notification targets them."
        />
      </section>

      <section aria-label="Breakdown" className="grid gap-4 lg:grid-cols-3">
        <ChannelActivityPanel days={days} byChannel={stats.byChannel} />
        {breakdown}
        <ReadRatePanel totals={totals} />
      </section>
    </>
  )
}

// Fleet-only card: the busiest apps in the window, each linking to its detail
// page so the overview stays a launchpad instead of a dead end.
export function TopAppsCard({
  days,
  topApps,
}: {
  days: number
  topApps: { appKey: string; appName: string; total: number }[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top apps</CardTitle>
        <CardDescription>Most notifications, last {days} days</CardDescription>
      </CardHeader>
      <CardContent>
        <Leaderboard
          items={topApps.map((app) => ({ key: app.appKey, label: app.appName, value: app.total }))}
          renderLabel={(item) => (
            <Link to="/dashboard/apps/$appKey" params={{ appKey: item.key }}>
              {item.label}
            </Link>
          )}
          ariaValueText={(item) => `${item.label}, ${item.value} notifications`}
          empty={
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No apps published anything</EmptyTitle>
                <EmptyDescription>Apps with notifications in the last {days} days show up here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          }
        />
      </CardContent>
    </Card>
  )
}
