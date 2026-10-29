import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { notificationPreflight, withNotificationCors } from '@/server/modules/notifications/http/notification-cors'
import { restoreInboxData } from '@/server/modules/notifications/http/notification-handler'

const METHODS = 'POST, OPTIONS'

// Moves archived ids back to the inbox. Their read state is kept.
export const Route = createFileRoute('/api/v1/apps/$appKey/inbox/restore')({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        withNotificationCors(request, params.appKey, METHODS, () =>
          withContext(async () => restoreInboxData(request, params))({ request }),
        ),
      OPTIONS: ({ request, params }) => notificationPreflight(request, params.appKey, METHODS),
    },
  },
})
