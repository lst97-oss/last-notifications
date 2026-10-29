import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { notificationPreflight, withNotificationCors } from '@/server/modules/notifications/http/notification-cors'
import { setPreferencesData } from '@/server/modules/notifications/http/notification-handler'

const METHODS = 'PUT, OPTIONS'

// Per-channel opt-out. An absent row means enabled, so this only ever records a switch.
export const Route = createFileRoute('/api/v1/apps/$appKey/recipients/$recipientKey/preferences')({
  server: {
    handlers: {
      PUT: ({ request, params }) =>
        withNotificationCors(request, params.appKey, METHODS, () =>
          withContext(async () => setPreferencesData(request, params))({ request }),
        ),
      OPTIONS: ({ request, params }) => notificationPreflight(request, params.appKey, METHODS),
    },
  },
})
