import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { notificationPreflight, withNotificationCors } from '@/server/modules/notifications/http/notification-cors'
import { markInboxReadData } from '@/server/modules/notifications/http/notification-handler'

const METHODS = 'POST, OPTIONS'

// Marks explicit ids or every unread item read. Idempotent: read_at is written once.
export const Route = createFileRoute('/api/v1/apps/$appKey/inbox/read')({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        withNotificationCors(request, params.appKey, METHODS, () =>
          withContext(async () => markInboxReadData(request, params))({ request }),
        ),
      OPTIONS: ({ request, params }) => notificationPreflight(request, params.appKey, METHODS),
    },
  },
})
