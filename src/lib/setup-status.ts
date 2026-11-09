import { createServerFn } from '@tanstack/react-start'

// The dynamic import keeps the business database code out of the browser bundle.
export const setupStatusServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { isInitialAdminSetupAvailable } = await import('@/server/modules/admin/infrastructure/admin-repository')
  return { setupAvailable: await isInitialAdminSetupAvailable() }
})
