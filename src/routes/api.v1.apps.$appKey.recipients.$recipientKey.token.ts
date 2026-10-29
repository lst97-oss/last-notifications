import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { mintRecipientTokenData } from '@/server/modules/notifications/http/notification-handler'

// Mints the short-lived read-only credential the consuming site hands to its
// browser, so the publish key never leaves the server. Secret shown once.
export const Route = createFileRoute('/api/v1/apps/$appKey/recipients/$recipientKey/token')({
  server: {
    handlers: {
      POST: ({ request, params }) => withContext(async () => mintRecipientTokenData(request, params))({ request }),
    },
  },
})
