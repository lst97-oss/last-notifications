'use client'

import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import { useState } from 'react'

import { ApiKeyScopePicker } from '@/components/dashboard/api-key-scope-picker'
import type { ChannelView } from '@/components/dashboard/channels/shell'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { apiKeyCreateFormSchema } from '@/lib/admin-schema'
import {
  type ApiKeyScope,
  applyFeatureSet,
  DEFAULT_FEATURES,
  FEATURES,
  type Feature,
  featuresOfChannels,
  scopesAfterFeatureToggle,
  scopesForFeatures,
} from '@/lib/api-key-scopes'
import { describeApiError, readApiData } from '@/lib/api-response'
import type { AppRow } from '@/routes/dashboard.apps'

// Keys expire after a year unless the operator chooses otherwise. Seconds, as the API takes them.
type ExpiryChoice = '30d' | '90d' | '1y' | 'never'
const EXPIRY_SECONDS: Record<ExpiryChoice, number | null> = {
  '30d': 2_592_000,
  '90d': 7_776_000,
  '1y': 31_536_000,
  never: null,
}
const DEFAULT_PER_MINUTE = 600

const FEATURE_LABELS: Record<Feature, string> = {
  inApp: 'In-app',
  email: 'Email',
  webpush: 'Web Push',
  webhook: 'Webhook',
}

type CreatedKey = { id: string; key: string; name: string; appKey: string | null }

type KeyDraft = {
  target: string | null
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

// The same channel list the app's detail page shows.
async function fetchAppChannels(appKey: string): Promise<ChannelView[]> {
  const response = await fetch(`/api/v1/admin/apps/${encodeURIComponent(appKey)}/channels`, {
    headers: { accept: 'application/json' },
  })
  const data = await readApiData<{ channels: ChannelView[] }>(response)
  return data.channels
}

// A key is a server credential bound to exactly one app. Its secret is shown once,
// then only the hash is readable.
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
          appKey: draft.target,
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

  const form = useForm({
    defaultValues: {
      target: null as string | null,
      name: '',
      features: [...DEFAULT_FEATURES],
      scopes: scopesForFeatures(DEFAULT_FEATURES),
      expiry: '1y' as ExpiryChoice,
      perMinute: DEFAULT_PER_MINUTE,
    },
    validators: { onChange: apiKeyCreateFormSchema },
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

  // Picking an app ticks the features it has switched on. If the read fails, the current selection stays.
  async function chooseApp(appKey: string) {
    form.setFieldValue('target', appKey)
    try {
      const channels = await queryClient.fetchQuery({
        queryKey: ['admin-app-channels', appKey],
        queryFn: () => fetchAppChannels(appKey),
      })
      // A later pick may have finished first, so only the latest pick is applied.
      if (form.state.values.target !== appKey) return
      const next = applyFeatureSet(
        { features: form.state.values.features, scopes: form.state.values.scopes },
        featuresOfChannels(channels),
      )
      form.setFieldValue('features', next.features)
      form.setFieldValue('scopes', next.scopes)
    } catch {
      // Keep the current features when the app's channels cannot be read.
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button type="button" />}>Create API key</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
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
            <ScrollArea className="max-h-[calc(100dvh-18rem)] pr-3">
              <FieldGroup>
                <form.Field name="target">
                  {(field) => (
                    <Field>
                      <FieldLabel>App</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(value) => {
                          if (value) void chooseApp(value)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an app" />
                        </SelectTrigger>
                        <SelectContent>
                          {(apps.data ?? []).map((app) => (
                            <SelectItem key={app.key} value={app.key}>
                              {app.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {apps.isSuccess && apps.data.length === 0 ? (
                        <FieldDescription>Create an app on the Apps page first.</FieldDescription>
                      ) : null}
                      {field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  )}
                </form.Field>
                <form.Field name="name">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor="key-name">Name</FieldLabel>
                      <Input
                        id="key-name"
                        maxLength={120}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                      {field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
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
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(Number(event.target.value))}
                      />
                      {field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
                      <FieldDescription>
                        Requests above this are refused with 429 until the minute resets.
                      </FieldDescription>
                    </Field>
                  )}
                </form.Field>
                <FieldSet>
                  <FieldLegend variant="label">Features</FieldLegend>
                  <form.Field name="features">
                    {(field) => (
                      <div className="flex flex-wrap gap-2">
                        {FEATURES.map((feature) => {
                          const id = `create-key-feature-${feature}`
                          const checked = field.state.value.includes(feature)
                          return (
                            <Badge
                              key={feature}
                              variant="outline"
                              className="h-7 gap-1.5 px-2.5 text-sm"
                              render={<label htmlFor={id} />}
                            >
                              <Checkbox
                                id={id}
                                checked={checked}
                                onCheckedChange={() => {
                                  const next = checked
                                    ? field.state.value.filter((item) => item !== feature)
                                    : [...field.state.value, feature]
                                  field.handleChange(next)
                                  form.setFieldValue(
                                    'scopes',
                                    scopesAfterFeatureToggle(form.state.values.scopes, next, feature),
                                  )
                                }}
                              />
                              {FEATURE_LABELS[feature]}
                            </Badge>
                          )
                        })}
                      </div>
                    )}
                  </form.Field>
                </FieldSet>
                <FieldSet>
                  <FieldLegend variant="label">Permissions</FieldLegend>
                  <FieldDescription>
                    Every key offers the same permissions and acts on its own app only.
                  </FieldDescription>
                  <form.Field name="scopes">
                    {(field) => (
                      <>
                        <ApiKeyScopePicker
                          idPrefix="create-key"
                          scopes={field.state.value}
                          onChange={field.handleChange}
                        />
                        {field.state.meta.isTouched && <FieldError errors={field.state.meta.errors} />}
                      </>
                    )}
                  </form.Field>
                </FieldSet>
              </FieldGroup>
            </ScrollArea>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={create.isPending}>
                Cancel
              </Button>
              <form.Subscribe selector={(state) => state.values.scopes.length === 0 || !state.values.target}>
                {(incomplete) => (
                  <Button type="submit" disabled={create.isPending || incomplete}>
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
