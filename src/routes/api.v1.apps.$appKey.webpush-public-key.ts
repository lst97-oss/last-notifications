import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { notificationPreflight, withNotificationCors } from '@/server/modules/notifications/http/notification-cors'
import { webpushPublicKeyData } from '@/server/modules/notifications/http/notification-handler'

const METHODS = 'GET, OPTIONS'

// The applicationServerKey a browser needs for pushManager.subscribe().
export const Route = createFileRoute('/api/v1/apps/$appKey/webpush-public-key')({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        withNotificationCors(request, params.appKey, METHODS, () =>
          withContext(async () => webpushPublicKeyData(request, params))({ request }),
        ),
      OPTIONS: ({ request, params }) => notificationPreflight(request, params.appKey, METHODS),
    },
  },
})
