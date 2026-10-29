import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ChannelPanel } from '@/components/dashboard/channels/registry'
import type { ChannelView } from '@/components/dashboard/channels/shell'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { type DashboardStats, DashboardStatsBody } from '@/components/dashboard/dashboard-stats-body'
import { Leaderboard } from '@/components/dashboard/leaderboard'
import { RangeToggle } from '@/components/dashboard/range-toggle'
import { SkeletonCards } from '@/components/dashboard/stats-panels'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { describeApiError, readApiData } from '@/lib/api-response'
import { formatDay, type Range } from '@/lib/dashboard-format'

type AppDetail = {
  app: { id: string; key: string; name: string; origin: string | null; createdAt: string }
  stats: DashboardStats
}

async function fetchAppDetail(appKey: string, days: Range): Promise<AppDetail> {
  const response = await fetch(`/api/v1/admin/apps/${encodeURIComponent(appKey)}/stats?days=${days}`, {
    headers: { accept: 'application/json' },
  })
  const data = await readApiData<{ detail: AppDetail }>(response)
  return data.detail
}

async function fetchChannels(appKey: string): Promise<ChannelView[]> {
  const response = await fetch(`/api/v1/admin/apps/${encodeURIComponent(appKey)}/channels`, {
    headers: { accept: 'application/json' },
  })
  const data = await readApiData<{ channels: ChannelView[] }>(response)
  return data.channels
}

export const Route = createFileRoute('/dashboard/apps_/$appKey')({
  component: AppDetailPage,
})

function AppDetailPage() {
  const { appKey } = Route.useParams()
  const [days, setDays] = useState<Range>('30')
  const detail = useQuery({
    queryKey: ['admin-app-stats', appKey, days],
    queryFn: () => fetchAppDetail(appKey, days),
    retry: false,
  })
  const channels = useQuery({
    queryKey: ['admin-app-channels', appKey],
    queryFn: () => fetchChannels(appKey),
    retry: false,
  })

  return (
    <DashboardPage
      width="wide"
      eyebrow={detail.data?.app.key ?? appKey}
      title={detail.data?.app.name ?? 'App'}
      description={
        detail.data
          ? `Origin ${detail.data.app.origin ?? 'not set'} · created ${formatDay(detail.data.app.createdAt.slice(0, 10))}.`
          : 'Stats and settings for one app.'
      }
      actions={<RangeToggle days={days} onChange={setDays} />}
    >
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/dashboard/apps" />}>Apps</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{detail.data?.app.name ?? appKey}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {detail.error ? (
        <Alert variant="destructive">
          <AlertDescription>{describeApiError(detail.error, 'Could not load app stats').message}</AlertDescription>
        </Alert>
      ) : null}

      {detail.isPending ? <SkeletonCards /> : null}

      {detail.data ? (
        <DashboardStatsBody
          stats={detail.data.stats}
          days={Number(days)}
          breakdown={<TopMoversCard detail={detail.data} days={Number(days)} />}
        />
      ) : null}

      <section aria-label="Configuration" className="grid gap-4 lg:grid-cols-2">
        {detail.data ? <AppSettingsCard key={appKey} appKey={appKey} app={detail.data.app} /> : null}
        <div className="flex flex-col gap-4">
          {channels.error ? (
            <Alert variant="destructive">
              <AlertDescription>{describeApiError(channels.error, 'Could not load channels').message}</AlertDescription>
            </Alert>
          ) : null}
          {channels.isPending ? <Skeleton className="h-64 rounded-xl" /> : null}
          {channels.data?.map((channel) => (
            <ChannelPanel key={channel.channel} appKey={appKey} channel={channel} />
          ))}
        </div>
      </section>
    </DashboardPage>
  )
}

// Editing lives here, not in the list: name and the origin the stream's
// allow-list checks are the only app-level fields the API accepts.
function AppSettingsCard({ appKey, app }: { appKey: string; app: AppDetail['app'] }) {
  const queryClient = useQueryClient()

  const save = useMutation({
    mutationFn: async (input: { name: string; origin: string }) => {
      const response = await fetch(`/api/v1/admin/apps/${encodeURIComponent(appKey)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      return readApiData<{ key: string; name: string }>(response)
    },
    onSuccess: async (updated) => {
      toast.add({ title: 'App updated', description: updated.name, type: 'success' })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-app-stats', appKey] }),
        queryClient.invalidateQueries({ queryKey: ['admin-apps'] }),
      ])
    },
  })

  const form = useForm({
    defaultValues: { name: app.name, origin: app.origin ?? '' },
    onSubmit: async ({ value }) => {
      // The mutation keeps the failure in `save.error`, which the card shows.
      try {
        await save.mutateAsync(value)
      } catch {
        // Shown below from save.error.
      }
    },
  })

  const error = save.error ? describeApiError(save.error, 'Could not update the app') : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>App settings</CardTitle>
        <CardDescription>Shown in the dashboard; the key never changes.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.Field name="name">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="app-settings-name">Name</FieldLabel>
                  <Input
                    id="app-settings-name"
                    required
                    maxLength={120}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="origin">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="app-settings-origin">Browser origin</FieldLabel>
                  <Input
                    id="app-settings-origin"
                    required
                    placeholder="https://app.example.com"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </Field>
              )}
            </form.Field>
          </FieldGroup>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          ) : null}
          <div>
            {/* Compared with the server's copy, not the form's starting values, so a saved edit disables Save again. */}
            <form.Subscribe
              selector={(state) => state.values.name !== app.name || state.values.origin !== (app.origin ?? '')}
            >
              {(dirty) => (
                <Button type="submit" disabled={save.isPending || !dirty}>
                  {save.isPending ? <Spinner data-icon="inline-start" /> : null}
                  Save changes
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// The per-app replacement for the fleet's Top apps card: what this app sends,
// and to whom.
function TopMoversCard({ detail, days }: { detail: AppDetail; days: number }) {
  const { topTypes, topRecipients } = detail.stats
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top senders</CardTitle>
        <CardDescription>Busiest types and recipients, last {days} days</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" render={<Link to="/dashboard/deliveries" />}>
            Inspect
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">Types</p>
          <Leaderboard
            items={topTypes.map((row) => ({ key: row.type, label: row.type, value: row.total }))}
            ariaValueText={(item) => `${item.label}, ${item.value} notifications`}
            empty={
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No types yet</EmptyTitle>
                  <EmptyDescription>Types appear once this app publishes.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">Recipients</p>
          <Leaderboard
            items={topRecipients.map((row) => ({
              key: row.recipientKey,
              label: row.recipientKey,
              value: row.total,
            }))}
            ariaValueText={(item) => `${item.label}, ${item.value} notifications`}
            empty={
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No recipients yet</EmptyTitle>
                  <EmptyDescription>Recipients appear once this app publishes.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            }
          />
        </div>
      </CardContent>
    </Card>
  )
}
