import { describe, expect, test } from 'bun:test'

import { getTurnstileConfig } from '@/server/auth/business-auth-config'

const env = {
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
}

describe('getTurnstileConfig', () => {
  test('is off when neither key is set', () => {
    expect(getTurnstileConfig(env)).toBeNull()
  })

  test('returns the pair when both keys are set', () => {
    expect(getTurnstileConfig({ ...env, TURNSTILE_SECRET_KEY: 'secret', TURNSTILE_SITE_KEY: 'site' })).toEqual({
      secretKey: 'secret',
      siteKey: 'site',
    })
  })

  test('refuses a half-configured pair', () => {
    expect(() => getTurnstileConfig({ ...env, TURNSTILE_SECRET_KEY: 'secret' })).toThrow()
    expect(() => getTurnstileConfig({ ...env, TURNSTILE_SITE_KEY: 'site' })).toThrow()
  })
})
