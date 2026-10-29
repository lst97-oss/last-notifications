import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { notificationPreflight, withNotificationCors } from '@/server/modules/notifications/http/notification-cors'
import { deleteNotificationData } from '@/server/modules/notifications/http/notification-handler'

const METHODS = 'DELETE, OPTIONS'

export const Route = createFileRoute('/api/v1/apps/$appKey/notifications/$id')({
  server: {
    handlers: {
      DELETE: ({ request, params }) =>
        withNotificationCors(request, params.appKey, METHODS, () =>
          withContext(async () => deleteNotificationData(request, params))({ request }),
        ),
      OPTIONS: ({ request, params }) => notificationPreflight(request, params.appKey, METHODS),
    },
  },
})
