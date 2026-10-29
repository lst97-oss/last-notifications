'use client'

import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { describeApiError, readApiData } from '@/lib/api-response'

export type CreatedApp = { id: string; key: string; name: string }

// The app's key is public (it names the tenant in URLs); the browser origin is
// what the stream's Origin allow-list checks, so both are set at creation.
export function AppCreateDialog({ onCreated }: { onCreated?: (app: CreatedApp) => void }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const create = useMutation({
    mutationFn: async (input: { name: string; origin: string }) => {
      const response = await fetch('/api/v1/admin/apps', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      return readApiData<CreatedApp>(response)
    },
    onSuccess: async (app) => {
      form.reset()
      setOpen(false)
      onCreated?.(app)
      await queryClient.invalidateQueries({ queryKey: ['admin-apps'] })
    },
  })

  const form = useForm({
    defaultValues: { name: '', origin: '' },
    onSubmit: async ({ value }) => {
      // The mutation keeps the failure in `create.error`, which the dialog shows.
      try {
        await create.mutateAsync(value)
      } catch {
        // Shown below from create.error.
      }
    },
  })

  const error = create.error ? describeApiError(create.error, 'Could not create the app') : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" />}>Create app</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create app</DialogTitle>
          <DialogDescription>
            One app per consuming site. Its key identifies the tenant in every API URL.
          </DialogDescription>
        </DialogHeader>
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
                  <FieldLabel htmlFor="app-name">Name</FieldLabel>
                  <Input
                    id="app-name"
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
                  <FieldLabel htmlFor="app-origin">Browser origin</FieldLabel>
                  <Input
                    id="app-origin"
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
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Spinner data-icon="inline-start" /> : null}
              Create app
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
