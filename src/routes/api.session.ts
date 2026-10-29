import { createFileRoute } from '@tanstack/react-router'

import { resolveSessionPrincipal } from '@/server/auth/resolve'
import { withContext } from '@/server/http/with-context'
import { hasDashboardAccess } from '@/server/modules/admin/infrastructure/dashboard-access'

// Provider-neutral session probe for the dashboard UI. `dashboard` says whether
// the identity may use the dashboard (admins only); never 401, so the UI can
// render a signed-out state.
export const Route = createFileRoute('/api/session')({
  server: {
    handlers: {
      GET: ({ request }) =>
        withContext(async () => {
          const principal = await resolveSessionPrincipal(request)
          return {
            principal: principal
              ? {
                  userId: principal.userId,
                  email: principal.email,
                  displayName: principal.displayName,
                  provider: principal.credential.provider,
                }
              : null,
            dashboard: principal ? await hasDashboardAccess(principal.userId) : false,
          }
        })({ request }),
    },
  },
})
