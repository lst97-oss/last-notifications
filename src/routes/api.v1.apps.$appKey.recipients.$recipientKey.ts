import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { getRecipientData } from '@/server/modules/notifications/http/recipient-handler'

// Host-facing, key-only: one recipient's masked contacts, preferences and push status.
export const Route = createFileRoute('/api/v1/apps/$appKey/recipients/$recipientKey')({
  server: {
    handlers: {
      GET: ({ request, params }) => withContext(async () => getRecipientData(request, params))({ request }),
    },
  },
})
