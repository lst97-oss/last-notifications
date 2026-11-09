import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { type DashboardStats, DashboardStatsBody, TopAppsCard } from '@/components/dashboard/dashboard-stats-body'
import { RangeToggle } from '@/components/dashboard/range-toggle'
import { SkeletonCards } from '@/components/dashboard/stats-panels'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { describeApiError, readApiData } from '@/lib/api-response'
import type { Range } from '@/lib/dashboard-format'

type FleetStats = DashboardStats & { topApps: { appKey: string; appName: string; total: number }[] }

async function fetchFleetStats(days: Range): Promise<FleetStats> {
  const response = await fetch(`/api/v1/admin/stats?days=${days}`, { headers: { accept: 'application/json' } })
  const data = await readApiData<{ stats: FleetStats }>(response)
  return data.stats
}

export const Route = createFileRoute('/dashboard/')({
  component: FleetOverviewPage,
})

function FleetOverviewPage() {
  const [days, setDays] = useState<Range>('30')
  const stats = useQuery({ queryKey: ['admin-fleet-stats', days], queryFn: () => fetchFleetStats(days), retry: false })

  return (
    <DashboardPage
      width="wide"
      eyebrow="Last Notifications"
      title="Overview"
      description="Every app you administer, in one view."
      actions={<RangeToggle days={days} onChange={setDays} />}
    >
      {stats.error ? (
        <Alert variant="destructive">
          <AlertDescription>{describeApiError(stats.error, 'Could not load dashboard data').message}</AlertDescription>
        </Alert>
      ) : null}

      {stats.isPending ? <SkeletonCards /> : null}

      {stats.data && stats.data.totals.published === 0 && stats.data.topApps.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No notifications yet</CardTitle>
            <CardDescription>The charts fill in as soon as an app publishes its first notification.</CardDescription>
          </CardHeader>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Nothing published in this period</EmptyTitle>
                <EmptyDescription>Create an app if you have none, then publish with its send key.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : null}

      {stats.data && (stats.data.totals.published > 0 || stats.data.topApps.length > 0) ? (
        <DashboardStatsBody
          stats={stats.data}
          range={days}
          breakdown={<TopAppsCard range={days} topApps={stats.data.topApps} />}
        />
      ) : null}
    </DashboardPage>
  )
}
