import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { notificationPreflight, withNotificationCors } from '@/server/modules/notifications/http/notification-cors'
import { setContactData } from '@/server/modules/notifications/http/notification-handler'
import { clearContactData } from '@/server/modules/notifications/http/recipient-handler'

const METHODS = 'PUT, OPTIONS'

// The address a channel can reach this recipient at. Only an app key with
// recipients:update may set it; a recipient token cannot.
export const Route = createFileRoute('/api/v1/apps/$appKey/recipients/$recipientKey/contact')({
  server: {
    handlers: {
      PUT: ({ request, params }) =>
        withNotificationCors(request, params.appKey, METHODS, () =>
          withContext(async () => setContactData(request, params))({ request }),
        ),
      // Host-only (a key with recipients:delete), so it is not offered to browsers and stays out of CORS.
      DELETE: ({ request, params }) => withContext(async () => clearContactData(request, params))({ request }),
      OPTIONS: ({ request, params }) => notificationPreflight(request, params.appKey, METHODS),
    },
  },
})
