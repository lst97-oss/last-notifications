import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { describeApiError, readApiData } from '@/lib/api-response'

export const Route = createFileRoute('/create-admin-user')({
  component: CreateAdminPage,
})

async function fetchSetupAvailable(): Promise<boolean> {
  const response = await fetch('/api/initial-admin', { headers: { accept: 'application/json' } })
  const data = await readApiData<{ available: boolean }>(response)
  return data.available
}

// First-run only: better-auth sign-up is closed, so the first admin is created
// here and the bootstrap endpoint refuses a second time.
function CreateAdminPage() {
  const navigate = useNavigate()
  const available = useQuery({ queryKey: ['initial-admin'], queryFn: fetchSetupAvailable })

  const create = useMutation({
    mutationFn: async (input: { name: string; email: string; password: string }) => {
      const response = await fetch('/api/initial-admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      return readApiData<{ user: { id: string } }>(response)
    },
    onSuccess: () => {
      void navigate({ to: '/dashboard/apps' })
    },
  })

  const form = useForm({
    defaultValues: { name: '', email: '', password: '' },
    onSubmit: async ({ value }) => {
      // The mutation keeps the failure in `create.error`, which the page shows.
      try {
        await create.mutateAsync(value)
      } catch {
        // Shown below from create.error.
      }
    },
  })

  const error = create.error ? describeApiError(create.error, 'Could not create the admin') : null

  return (
    <div className="grid min-h-svh place-items-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create the first admin</CardTitle>
          <CardDescription>
            {available.data === false
              ? 'Setup has already been used. Sign in instead.'
              : 'This account administers the instance and can create apps and keys.'}
          </CardDescription>
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
                    <FieldLabel htmlFor="name">Name</FieldLabel>
                    <Input
                      id="name"
                      required
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="email">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="password">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
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
            <Button type="submit" disabled={create.isPending || available.data === false}>
              Create admin
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
