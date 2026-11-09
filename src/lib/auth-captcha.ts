import { createServerFn } from '@tanstack/react-start'

// Only the public site key crosses to the browser; the secret stays in the auth
// instance. The dynamic import keeps the env schema out of the client bundle.
export const authCaptchaServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { getTurnstileConfig } = await import('@/server/auth/business-auth-config')
  return { siteKey: getTurnstileConfig()?.siteKey ?? null }
})
