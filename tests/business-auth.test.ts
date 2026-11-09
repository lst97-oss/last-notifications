import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { HttpStatus } from '@lst97-oss/last-httprism'

import { createBusinessAuth } from '@/server/auth/business-auth'

// Turnstile is opt-in. With its keys set, a sign-in that carries no captcha token is refused before the
// password is checked. Builds its own instance, so the shared singleton keeps its own settings.
describe('sign-in with Turnstile on', () => {
  beforeEach(() => {
    Bun.env.TURNSTILE_SECRET_KEY = 'turnstile-test-secret'
    Bun.env.TURNSTILE_SITE_KEY = 'turnstile-test-site'
  })

  afterEach(() => {
    delete Bun.env.TURNSTILE_SECRET_KEY
    delete Bun.env.TURNSTILE_SITE_KEY
  })

  test('a sign-in with no captcha token is refused before the password is checked', async () => {
    const origin = Bun.env.BETTER_AUTH_URL ?? 'http://localhost'
    const response = await createBusinessAuth().handler(
      new Request(`${origin}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify({ email: 'nobody@example.test', password: 'not-the-password' }),
      }),
    )
    expect(response.status).toBe(HttpStatus.BAD_REQUEST.code)
    expect(await response.json()).toMatchObject({ code: 'MISSING_RESPONSE' })
  })
})
