'use client'

import { useForm } from '@tanstack/react-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { TurnstileWidget } from '@/components/dashboard/turnstile-widget'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { authCaptchaServerFn } from '@/lib/auth-captcha'
import { authClient, SESSION_QUERY_KEY } from '@/lib/business-auth-client'

export function AdminLogin() {
  const [error, setError] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  // Tokens are single-use; a fresh widget is the reset.
  const [captchaAttempt, setCaptchaAttempt] = useState(0)
  const queryClient = useQueryClient()
  const captcha = useQuery({
    queryKey: ['auth-captcha'],
    queryFn: () => authCaptchaServerFn(),
    staleTime: Infinity,
    retry: false,
  })
  const siteKey = captcha.data?.siteKey ?? null

  const resetCaptcha = () => {
    setCaptchaToken(null)
    setCaptchaAttempt((attempt) => attempt + 1)
  }

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setError('')
      if (siteKey && !captchaToken) {
        setError('Complete the verification first.')
        return
      }
      // Every outcome, including a thrown request, ends the submitting state.
      try {
        const result = await authClient.signIn.email({
          ...value,
          ...(captchaToken ? { fetchOptions: { headers: { 'x-captcha-response': captchaToken } } } : {}),
        })
        if (result.error) {
          setError(result.error.message ?? 'Sign-in failed')
          resetCaptcha()
          return
        }
        await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
      } catch {
        setError('Could not reach the server. Try again.')
        resetCaptcha()
      }
    },
  })

  return (
    <div className="grid min-h-svh place-items-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>The notification dashboard is for administrators.</CardDescription>
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
              <form.Field name="email">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
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
                      autoComplete="current-password"
                      required
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </Field>
                )}
              </form.Field>
            </FieldGroup>
            {siteKey ? <TurnstileWidget key={captchaAttempt} siteKey={siteKey} onToken={setCaptchaToken} /> : null}
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting || captcha.isPending || Boolean(siteKey && !captchaToken)}>
                  {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
                  Sign in
                </Button>
              )}
            </form.Subscribe>
            <p className="text-xs text-muted-foreground">
              First run?{' '}
              <a className="underline" href="/create-admin-user">
                Create the first admin
              </a>
              .
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
