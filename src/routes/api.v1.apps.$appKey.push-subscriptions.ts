import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { notificationPreflight, withNotificationCors } from '@/server/modules/notifications/http/notification-cors'
import { subscribePushData, unsubscribePushData } from '@/server/modules/notifications/http/notification-handler'

const METHODS = 'POST, DELETE, OPTIONS'

// The browser registers its PushSubscription here after asking the user for
// permission; the recipient token identifies whose browser it is.
export const Route = createFileRoute('/api/v1/apps/$appKey/push-subscriptions')({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        withNotificationCors(request, params.appKey, METHODS, () =>
          withContext(async () => subscribePushData(request, params))({ request }),
        ),
      DELETE: ({ request, params }) =>
        withNotificationCors(request, params.appKey, METHODS, () =>
          withContext(async () => unsubscribePushData(request, params))({ request }),
        ),
      OPTIONS: ({ request, params }) => notificationPreflight(request, params.appKey, METHODS),
    },
  },
})
