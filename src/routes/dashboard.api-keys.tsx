import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { KeyRound } from 'lucide-react'
import { useState } from 'react'

import { ApiKeyCreateDialog } from '@/components/dashboard/api-key-create-dialog'
import { ApiKeyEditDialog } from '@/components/dashboard/api-key-edit-dialog'
import { ApiKeyRow } from '@/components/dashboard/api-key-row'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ItemGroup } from '@/components/ui/item'
import type { ApiKeyRecord } from '@/lib/api-keys'
import { describeApiError, readApiData } from '@/lib/api-response'

const KEYS_KEY = ['admin-api-keys'] as const

async function fetchKeys(): Promise<ApiKeyRecord[]> {
  const response = await fetch('/api/v1/admin/api-keys', { headers: { accept: 'application/json' } })
  const data = await readApiData<{ keys: ApiKeyRecord[] }>(response)
  return data.keys
}

export const Route = createFileRoute('/dashboard/api-keys')({
  component: ApiKeysPage,
})

function ApiKeysPage() {
  const queryClient = useQueryClient()
  const keys = useQuery({ queryKey: KEYS_KEY, queryFn: fetchKeys })
  const [editing, setEditing] = useState<ApiKeyRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyRecord | null>(null)

  const toggle = useMutation({
    mutationFn: async (key: ApiKeyRecord) => {
      const response = await fetch('/api/v1/admin/api-keys', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          keyId: key.id,
          enabled: !key.enabled,
          ...(key.metadata?.app ? { appKey: key.metadata.app } : {}),
        }),
      })
      return readApiData<{ updated: boolean }>(response)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS_KEY }),
  })

  const remove = useMutation({
    mutationFn: async (key: ApiKeyRecord) => {
      const params = new URLSearchParams({
        keyId: key.id,
        ...(key.metadata?.app ? { appKey: key.metadata.app } : {}),
      })
      const response = await fetch(`/api/v1/admin/api-keys?${params.toString()}`, { method: 'DELETE' })
      return readApiData<{ deleted: boolean }>(response)
    },
    onSuccess: async () => {
      setDeleteTarget(null)
      await queryClient.invalidateQueries({ queryKey: KEYS_KEY })
    },
  })

  const mutationError = toggle.error ?? remove.error
  const error = mutationError ? describeApiError(mutationError, 'Could not change the key') : null
  const pending = toggle.isPending || remove.isPending

  const list = keys.data ?? []
  const appKeys = list.filter((key) => key.metadata?.app)
  const instanceKeys = list.filter((key) => !key.metadata?.app)

  function row(key: ApiKeyRecord) {
    return (
      <ApiKeyRow
        key={key.id}
        apiKey={key}
        pending={pending}
        onEdit={() => setEditing(key)}
        onToggleEnabled={() => toggle.mutate(key)}
        onRequestDelete={() => setDeleteTarget(key)}
      />
    )
  }

  return (
    <DashboardPage
      eyebrow="Last Notifications"
      title="API keys"
      description="Server-to-server keys with least-privilege permissions. Secrets are shown once at creation."
      actions={<ApiKeyCreateDialog />}
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
      {keys.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {keys.error ? (
        <Alert variant="destructive">
          <AlertDescription>{describeApiError(keys.error, 'Could not load keys').message}</AlertDescription>
        </Alert>
      ) : null}
      {keys.data?.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <KeyRound />
                </EmptyMedia>
                <EmptyTitle>No API keys yet</EmptyTitle>
                <EmptyDescription>
                  Create a key: pick an app (or the instance), tick the permissions the caller needs, then copy the
                  secret.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : null}
      {list.length > 0 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>App keys</CardTitle>
              <CardDescription>
                {appKeys.length
                  ? `${appKeys.length} ${appKeys.length === 1 ? 'key' : 'keys'}, each bound to one app.`
                  : 'No app keys yet.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {appKeys.length ? (
                <ItemGroup>{appKeys.map(row)}</ItemGroup>
              ) : (
                <p className="text-sm text-muted-foreground">Create one to publish and read for that app.</p>
              )}
            </CardContent>
          </Card>
          {instanceKeys.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Instance API keys</CardTitle>
                <CardDescription>Not bound to an app. These keys manage apps.</CardDescription>
              </CardHeader>
              <CardContent>
                <ItemGroup>{instanceKeys.map(row)}</ItemGroup>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
      {editing ? <ApiKeyEditDialog key={editing.id} apiKey={editing} onClose={() => setEditing(null)} /> : null}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(next) => !next && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name ?? deleteTarget?.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              Anything using this key, such as your server or proxy, stops working immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => deleteTarget && remove.mutate(deleteTarget)}
            >
              {remove.isPending ? 'Deleting…' : 'Delete API key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardPage>
  )
}
