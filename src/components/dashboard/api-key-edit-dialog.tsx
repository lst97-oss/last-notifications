'use client'

import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { ApiKeyScopePicker } from '@/components/dashboard/api-key-scope-picker'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldError, FieldLegend, FieldSet } from '@/components/ui/field'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { apiKeyEditFormSchema } from '@/lib/admin-schema'
import { type ApiKeyScope, scopesOfPermissions } from '@/lib/api-key-scopes'
import type { ApiKeyRecord } from '@/lib/api-keys'
import { describeApiError, readApiData } from '@/lib/api-response'

// The binding and the name are fixed once a key exists; only permissions change.
export function ApiKeyEditDialog({ apiKey, onClose }: { apiKey: ApiKeyRecord; onClose: () => void }) {
  const queryClient = useQueryClient()

  const save = useMutation({
    mutationFn: async (scopes: ApiKeyScope[]) => {
      const response = await fetch('/api/v1/admin/api-keys', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          keyId: apiKey.id,
          scopes,
          ...(apiKey.metadata?.app ? { appKey: apiKey.metadata.app } : {}),
        }),
      })
      return readApiData<{ updated: boolean }>(response)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] })
      onClose()
    },
  })

  const form = useForm({
    defaultValues: { scopes: scopesOfPermissions(apiKey.permissions) },
    validators: { onChange: apiKeyEditFormSchema },
    onSubmit: async ({ value }) => {
      // The mutation keeps the failure in `save.error`, which the dialog shows.
      try {
        await save.mutateAsync(value.scopes)
      } catch {
        // Shown below from save.error.
      }
    },
  })

  const error = save.error ? describeApiError(save.error, 'Could not save the key') : null
  const binding = apiKey.metadata?.app ?? 'instance'

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit API key</DialogTitle>
          <DialogDescription>
            {apiKey.name ?? 'Unnamed key'} · {binding} · <code className="font-mono">{apiKey.start ?? apiKey.id}</code>.
            The app and name stay fixed.
          </DialogDescription>
        </DialogHeader>
        <FieldSet>
          <FieldLegend variant="label">Permissions</FieldLegend>
          <ScrollArea className="max-h-[calc(100dvh-18rem)] pr-3">
            <form.Field name="scopes">
              {(field) => (
                <>
                  <ApiKeyScopePicker
                    idPrefix={`edit-${apiKey.id}`}
                    scopes={field.state.value}
                    onChange={field.handleChange}
                  />
                  {field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
                </>
              )}
            </form.Field>
          </ScrollArea>
        </FieldSet>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <form.Subscribe selector={(state) => state.values.scopes.length === 0}>
            {(noScopes) => (
              <Button type="button" onClick={() => void form.handleSubmit()} disabled={save.isPending || noScopes}>
                {save.isPending ? <Spinner data-icon="inline-start" /> : null}
                Save permissions
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
