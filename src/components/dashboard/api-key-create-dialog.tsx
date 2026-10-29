'use client'

import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import { useState } from 'react'

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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { type ApiKeyScope, DEFAULT_APP_SCOPES, DEFAULT_INSTANCE_SCOPES } from '@/lib/api-key-scopes'
import { describeApiError, readApiData } from '@/lib/api-response'
import type { AppRow } from '@/routes/dashboard.apps'

const INSTANCE = 'instance'

// Keys expire after a year unless the operator chooses otherwise. Seconds, as the API takes them.
type ExpiryChoice = '30d' | '90d' | '1y' | 'never'
const EXPIRY_SECONDS: Record<ExpiryChoice, number | null> = {
  '30d': 2_592_000,
  '90d': 7_776_000,
  '1y': 31_536_000,
  never: null,
}
const DEFAULT_PER_MINUTE = 600

type CreatedKey = { id: string; key: string; name: string; appKey: string | null }

type KeyDraft = {
  target: string
  name: string
  scopes: ApiKeyScope[]
  expiry: ExpiryChoice
  perMinute: number
}

async function fetchApps(): Promise<AppRow[]> {
  const response = await fetch('/api/v1/admin/apps', { headers: { accept: 'application/json' } })
  const data = await readApiData<{ apps: AppRow[] }>(response)
  return data.apps
}

// A key is a server credential bound to exactly one app (or to the instance for
// app management). Its secret is shown once, then only the hash is readable.
export function ApiKeyCreateDialog() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  // The secret is shown once, so it lives in dialog state, not in the form.
  const [secret, setSecret] = useState<string | null>(null)

  const apps = useQuery({ queryKey: ['admin-apps'], queryFn: fetchApps, enabled: open })

  const create = useMutation({
    mutationFn: async (draft: KeyDraft) => {
      const response = await fetch('/api/v1/admin/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          scopes: draft.scopes,
          ...(draft.target === INSTANCE ? {} : { appKey: draft.target }),
          ...(EXPIRY_SECONDS[draft.expiry] === null ? {} : { expiresIn: EXPIRY_SECONDS[draft.expiry] }),
          rateLimit: { windowMs: 60_000, max: draft.perMinute },
        }),
      })
      return readApiData<CreatedKey>(response)
    },
    onSuccess: async (created) => {
      setSecret(created.key)
      form.setFieldValue('name', '')
      await queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] })
    },
  })

  // The picker starts on the instance target, so the scopes start there too: the target's
  // onChange only fires once the user picks something.
  const form = useForm({
    defaultValues: {
      target: INSTANCE,
      name: '',
      scopes: DEFAULT_INSTANCE_SCOPES,
      expiry: '1y' as ExpiryChoice,
      perMinute: DEFAULT_PER_MINUTE,
    },
    onSubmit: async ({ value }) => {
      // The mutation keeps the failure in `create.error`, which the dialog shows.
      try {
        await create.mutateAsync(value)
      } catch {
        // Shown below from create.error.
      }
    },
  })

  const error = create.error ? describeApiError(create.error, 'Could not create the key') : null

  function changeOpen(next: boolean) {
    setOpen(next)
    // Another key needs a fresh dialog: the previous secret is gone for good.
    if (!next) {
      setSecret(null)
      create.reset()
      form.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button type="button" />}>Create API key</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
          <DialogDescription>
            {secret
              ? 'Copy the secret now — it is not shown again.'
              : 'Least privilege: grant only what the caller does.'}
          </DialogDescription>
        </DialogHeader>
        {secret ? (
          <div className="grid gap-3">
            <Alert>
              <AlertDescription>
                <code className="block break-all font-mono text-xs">{secret}</code>
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(secret)}>
                <Copy />
                Copy key
              </Button>
              <Button type="button" onClick={() => changeOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <FieldGroup>
              <form.Field name="target">
                {(field) => (
                  <Field>
                    <FieldLabel>App</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => {
                        const next = value ?? INSTANCE
                        field.handleChange(next)
                        form.setFieldValue('scopes', next === INSTANCE ? DEFAULT_INSTANCE_SCOPES : DEFAULT_APP_SCOPES)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={INSTANCE}>Instance (manage apps)</SelectItem>
                        {(apps.data ?? []).map((app) => (
                          <SelectItem key={app.key} value={app.key}>
                            {app.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>
              <form.Field name="name">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="key-name">Name</FieldLabel>
                    <Input
                      id="key-name"
                      required
                      maxLength={120}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="expiry">
                {(field) => (
                  <Field>
                    <FieldLabel>Expires</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange((value ?? '1y') as ExpiryChoice)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30d">In 30 days</SelectItem>
                        <SelectItem value="90d">In 90 days</SelectItem>
                        <SelectItem value="1y">In 1 year</SelectItem>
                        <SelectItem value="never">Never</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      An expired key is refused. To rotate, create a new key, deploy it, then delete this one.
                    </FieldDescription>
                  </Field>
                )}
              </form.Field>
              <form.Field name="perMinute">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="key-rate">Requests per minute</FieldLabel>
                    <Input
                      id="key-rate"
                      type="number"
                      min={1}
                      max={1_000_000}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(Number(event.target.value))}
                    />
                    <FieldDescription>
                      Requests above this are refused with 429 until the minute resets.
                    </FieldDescription>
                  </Field>
                )}
              </form.Field>
              <FieldSet>
                <FieldLegend variant="label">Permissions</FieldLegend>
                <FieldDescription>
                  Every key offers the same permissions. The app binding decides tenancy: instance keys manage apps, app
                  keys act on their own app.
                </FieldDescription>
                <form.Field name="scopes">
                  {(field) => (
                    <ApiKeyScopePicker idPrefix="create-key" scopes={field.state.value} onChange={field.handleChange} />
                  )}
                </form.Field>
              </FieldSet>
            </FieldGroup>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={create.isPending}>
                Cancel
              </Button>
              <form.Subscribe selector={(state) => state.values.scopes.length === 0}>
                {(noScopes) => (
                  <Button type="submit" disabled={create.isPending || noScopes}>
                    {create.isPending ? <Spinner data-icon="inline-start" /> : null}
                    Create key
                  </Button>
                )}
              </form.Subscribe>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
