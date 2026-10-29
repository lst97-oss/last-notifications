import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { notificationPreflight, withNotificationCors } from '@/server/modules/notifications/http/notification-cors'
import { archiveInboxData } from '@/server/modules/notifications/http/notification-handler'

const METHODS = 'POST, OPTIONS'

// Archives explicit ids, or every read item with `read: true`. Archiving marks the row read.
export const Route = createFileRoute('/api/v1/apps/$appKey/inbox/archive')({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        withNotificationCors(request, params.appKey, METHODS, () =>
          withContext(async () => archiveInboxData(request, params))({ request }),
        ),
      OPTIONS: ({ request, params }) => notificationPreflight(request, params.appKey, METHODS),
    },
  },
})
