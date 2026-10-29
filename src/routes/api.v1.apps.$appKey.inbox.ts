import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { notificationPreflight, withNotificationCors } from '@/server/modules/notifications/http/notification-cors'
import { listInboxData } from '@/server/modules/notifications/http/notification-handler'

const METHODS = 'GET, OPTIONS'

// Ascending keyset page: `?since=<next>` continues, `?limit=` caps at 100.
export const Route = createFileRoute('/api/v1/apps/$appKey/inbox')({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        withNotificationCors(request, params.appKey, METHODS, () =>
          withContext(async () => listInboxData(request, params))({ request }),
        ),
      OPTIONS: ({ request, params }) => notificationPreflight(request, params.appKey, METHODS),
    },
  },
})
