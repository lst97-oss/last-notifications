import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Send } from 'lucide-react'
import { useState } from 'react'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { describeApiError, readApiData } from '@/lib/api-response'
import type { AppRow } from '@/routes/dashboard.apps'

type DeliveryRow = {
  id: string
  channel: string
  status: 'pending' | 'processing' | 'delivered' | 'dead_letter'
  attempts: number
  lastError: string | null
  title: string
  recipientKey: string
  appKey: string
  createdAt: string
}

type DeliveriesPage = { deliveries: DeliveryRow[]; total: number; limit: number; offset: number }

const ALL = 'all'
const PAGE_SIZE = 20
const DELIVERIES_KEY = ['admin-deliveries'] as const

async function fetchApps(): Promise<AppRow[]> {
  const response = await fetch('/api/v1/admin/apps', { headers: { accept: 'application/json' } })
  const data = await readApiData<{ apps: AppRow[] }>(response)
  return data.apps
}

async function fetchDeliveries(input: { appKey: string; status: string; offset: number }): Promise<DeliveriesPage> {
  const params = new URLSearchParams({ appKey: input.appKey, limit: String(PAGE_SIZE), offset: String(input.offset) })
  if (input.status !== ALL) params.set('status', input.status)
  const response = await fetch(`/api/v1/admin/deliveries?${params.toString()}`, {
    headers: { accept: 'application/json' },
  })
  return readApiData<DeliveriesPage>(response)
}

export const Route = createFileRoute('/dashboard/deliveries')({
  component: DeliveriesPage,
})

function DeliveriesPage() {
  const queryClient = useQueryClient()
  const apps = useQuery({ queryKey: ['admin-apps'], queryFn: fetchApps })
  // One app at a time: the operator picks whose queue to inspect, so a mixed list
  // never hides another tenant's dead letter. Defaults to the first app once loaded.
  const [selectedApp, setSelectedApp] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('dead_letter')
  const [offset, setOffset] = useState(0)
  const appKey = selectedApp ?? apps.data?.[0]?.key ?? ''

  const deliveries = useQuery({
    queryKey: [...DELIVERIES_KEY, appKey, status, offset],
    queryFn: () => fetchDeliveries({ appKey, status, offset }),
    enabled: appKey !== '',
    placeholderData: keepPreviousData,
  })

  const retry = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/v1/admin/deliveries/${id}/retry`, { method: 'POST' })
      return readApiData<{ retried: boolean }>(response)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DELIVERIES_KEY }),
  })

  const retryError = retry.error ? describeApiError(retry.error, 'Could not retry the delivery') : null
  const total = deliveries.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.floor(offset / PAGE_SIZE)

  function changeApp(next: string) {
    setSelectedApp(next)
    setOffset(0)
  }

  function changeStatus(next: string) {
    setStatus(next)
    setOffset(0)
  }

  return (
    <DashboardPage
      eyebrow="Last Notifications"
      title="Deliveries"
      description="The outbox per app and channel. A dead letter exhausted its retries; retrying resets it for another pass."
      actions={
        <div className="flex flex-wrap items-end gap-3">
          <Field orientation="horizontal" className="w-auto">
            <FieldLabel htmlFor="deliveries-app" className="text-muted-foreground">
              App
            </FieldLabel>
            <Select value={appKey || null} onValueChange={(value) => value && changeApp(value)}>
              <SelectTrigger id="deliveries-app" className="min-w-44">
                <SelectValue placeholder="Select an app" />
              </SelectTrigger>
              <SelectContent>
                {(apps.data ?? []).map((app) => (
                  <SelectItem key={app.key} value={app.key}>
                    {app.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field orientation="horizontal" className="w-auto">
            <FieldLabel htmlFor="deliveries-status" className="text-muted-foreground">
              Status
            </FieldLabel>
            <Select value={status} onValueChange={(value) => changeStatus(value ?? ALL)}>
              <SelectTrigger id="deliveries-status" className="min-w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any status</SelectItem>
                <SelectItem value="dead_letter">Dead letters</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      }
    >
      {retryError ? (
        <Alert variant="destructive">
          <AlertDescription>{retryError.message}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Queue</CardTitle>
          <CardDescription>
            {apps.data?.length === 0
              ? 'No apps yet — create one first.'
              : total > 0
                ? `${total} ${total === 1 ? 'delivery matches' : 'deliveries match'} this filter${pageCount > 1 ? ` · page ${page + 1} of ${pageCount}` : ''}.`
                : 'Nothing matches this filter.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deliveries.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
          {deliveries.error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {describeApiError(deliveries.error, 'Could not load deliveries').message}
              </AlertDescription>
            </Alert>
          ) : null}
          {deliveries.data && deliveries.data.deliveries.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Send />
                </EmptyMedia>
                <EmptyTitle>No deliveries here</EmptyTitle>
                <EmptyDescription>
                  Dead letters and retries appear here. Publish with an async channel to see rows.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {deliveries.data && deliveries.data.deliveries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Notification</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.data.deliveries.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span className="block">{row.title}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{row.recipientKey}</span>
                    </TableCell>
                    <TableCell>{row.channel}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'delivered' ? 'default' : 'outline'}>{row.status}</Badge>
                    </TableCell>
                    <TableCell>{row.attempts}</TableCell>
                    <TableCell className="max-w-40 truncate text-xs" title={row.lastError ?? undefined}>
                      {row.lastError ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={retry.isPending || row.status === 'delivered'}
                        onClick={() => retry.mutate(row.id)}
                      >
                        Retry
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      {pageCount > 1 ? (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="ghost"
                size="default"
                disabled={page === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                <ChevronLeft data-icon="inline-start" />
                <span className="hidden sm:block">Previous</span>
              </Button>
            </PaginationItem>
            {pageNumbers(page, pageCount).map((entry, index) =>
              entry === null ? (
                <PaginationItem key={`gap-${index}`}>
                  <span aria-hidden className="px-1 text-sm text-muted-foreground">
                    …
                  </span>
                </PaginationItem>
              ) : (
                <PaginationItem key={entry}>
                  <Button
                    variant={entry === page ? 'outline' : 'ghost'}
                    size="icon"
                    aria-current={entry === page ? 'page' : undefined}
                    aria-label={`Page ${entry + 1}`}
                    onClick={() => setOffset(entry * PAGE_SIZE)}
                  >
                    {entry + 1}
                  </Button>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <Button
                variant="ghost"
                size="default"
                disabled={page >= pageCount - 1}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                <span className="hidden sm:block">Next</span>
                <ChevronRight data-icon="inline-end" />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </DashboardPage>
  )
}

// First, last, and a two-page window around the current page; null is an ellipsis.
function pageNumbers(page: number, pageCount: number): (number | null)[] {
  const window = new Set<number>([0, pageCount - 1, page - 1, page, page + 1])
  const pages = [...window].filter((value) => value >= 0 && value < pageCount).sort((a, b) => a - b)
  const result: (number | null)[] = []
  for (const [index, value] of pages.entries()) {
    const previous = pages[index - 1]
    if (previous !== undefined && value - previous > 1) result.push(null)
    result.push(value)
  }
  return result
}
