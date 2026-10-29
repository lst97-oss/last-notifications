import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Copy, EllipsisVertical, Smartphone, SquarePen, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { AppCreateDialog } from '@/components/dashboard/app-create-dialog'
import { ConfirmDeleteDialog } from '@/components/dashboard/confirm-delete-dialog'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { describeApiError, readApiData } from '@/lib/api-response'

export type AppRow = { id: string; key: string; name: string; createdAt: string }

const APPS_KEY = ['admin-apps'] as const

async function fetchApps(): Promise<AppRow[]> {
  const response = await fetch('/api/v1/admin/apps', { headers: { accept: 'application/json' } })
  const data = await readApiData<{ apps: AppRow[] }>(response)
  return data.apps
}

// Case-insensitive match on name or key; a blank query keeps every app.
export function filterApps(apps: AppRow[], query: string): AppRow[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return apps
  return apps.filter((app) => app.name.toLowerCase().includes(needle) || app.key.toLowerCase().includes(needle))
}

function copyKey(key: string) {
  navigator.clipboard.writeText(key).then(
    () => toast.add({ title: 'App key copied', type: 'success' }),
    () => toast.add({ title: 'Could not copy the key', type: 'error' }),
  )
}

export const Route = createFileRoute('/dashboard/apps')({
  component: AppsPage,
})

// The list is the fleet index, not the editor: settings and channels live on the
// app's own page, so a row only navigates or deletes.
function AppsPage() {
  const queryClient = useQueryClient()
  const apps = useQuery({ queryKey: APPS_KEY, queryFn: fetchApps })
  const [deleteTarget, setDeleteTarget] = useState<AppRow | null>(null)
  const [query, setQuery] = useState('')

  const remove = useMutation({
    mutationFn: async (appKey: string) => {
      const response = await fetch(`/api/v1/admin/apps/${encodeURIComponent(appKey)}`, { method: 'DELETE' })
      return readApiData<{ deleted: boolean }>(response)
    },
    onSuccess: async (_result, appKey) => {
      setDeleteTarget(null)
      toast.add({ title: 'App deleted', description: appKey, type: 'success' })
      await queryClient.invalidateQueries({ queryKey: APPS_KEY })
    },
  })

  const error = apps.error ? describeApiError(apps.error, 'Could not load apps') : null
  const deleteError = remove.error ? describeApiError(remove.error, 'Could not delete the app') : null
  const matches = filterApps(apps.data ?? [], query)

  return (
    <DashboardPage
      eyebrow="Last Notifications"
      title="Apps"
      description="One app per consuming site. The app key identifies the tenant; API keys are the secrets. Open an app to edit it or manage its channels."
      actions={<AppCreateDialog />}
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
      {deleteError ? (
        <Alert variant="destructive">
          <AlertDescription>{deleteError.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Your apps</CardTitle>
          <CardDescription>
            {apps.data?.length
              ? `${apps.data.length} ${apps.data.length === 1 ? 'app' : 'apps'} registered on this instance.`
              : 'No apps yet.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {apps.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
          {apps.data?.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Smartphone />
                </EmptyMedia>
                <EmptyTitle>No apps yet</EmptyTitle>
                <EmptyDescription>
                  Create the first app: give it a name and the browser origin its users come from.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {apps.data && apps.data.length > 0 ? (
            <>
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name or key"
                aria-label="Search apps"
                className="max-w-sm"
              />
              {/* Stacked rows below a 36rem container, a name-and-actions grid from there up. */}
              {matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No apps match “{query.trim()}”.</p>
              ) : (
                <ul className="@container/apps m-0 list-none p-0">
                  {matches.map((app) => (
                    <li
                      key={app.id}
                      className="flex flex-col gap-3 border-t py-4 @xl/apps:grid @xl/apps:grid-cols-[minmax(0,1fr)_auto] @xl/apps:items-center @xl/apps:gap-6 @xl/apps:py-3"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <Link
                          to="/dashboard/apps/$appKey"
                          params={{ appKey: app.key }}
                          className="font-medium break-words underline-offset-4 hover:underline"
                        >
                          {app.name}
                        </Link>
                        <div className="flex min-w-0 items-center gap-1">
                          <span className="font-mono text-xs break-all text-muted-foreground">{app.key}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Copy key for ${app.name}`}
                            onClick={() => copyKey(app.key)}
                          >
                            <Copy />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 @xl/apps:justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 @xl/apps:flex-none"
                          render={<Link to="/dashboard/apps/$appKey" params={{ appKey: app.key }} />}
                        >
                          <SquarePen data-icon="inline-start" />
                          Edit
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`More actions for ${app.name}`}
                              />
                            }
                          >
                            <EllipsisVertical />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              render={
                                <Link to="/dashboard/apps/$appKey" params={{ appKey: app.key }}>
                                  <SquarePen />
                                  Edit app
                                </Link>
                              }
                            />
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(app)}>
                              <Trash2 />
                              Delete app
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title="Delete this app?"
        description={
          deleteTarget
            ? `${deleteTarget.name} and every notification, delivery, subscription, and key binding it owns are removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete app"
        pendingLabel="Deleting…"
        pending={remove.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.key)}
      />
    </DashboardPage>
  )
}
