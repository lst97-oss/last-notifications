import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { unsubscribeConfirmData, unsubscribeData } from '@/server/modules/notifications/http/notification-handler'

// RFC 8058 one-click target: POST changes state. GET only shows a confirmation page.
export const Route = createFileRoute('/api/v1/unsubscribe')({
  server: {
    handlers: {
      POST: ({ request }) => withContext(async () => unsubscribeData(request))({ request }),
      GET: ({ request }) => withContext(async () => unsubscribeConfirmData(request))({ request }),
    },
  },
})
