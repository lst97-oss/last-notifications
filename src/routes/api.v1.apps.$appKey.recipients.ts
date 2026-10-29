import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { listRecipientsData } from '@/server/modules/notifications/http/recipient-handler'

// Host-facing, key-only: keyset page of the app's recipient keys.
export const Route = createFileRoute('/api/v1/apps/$appKey/recipients')({
  server: {
    handlers: {
      GET: ({ request, params }) => withContext(async () => listRecipientsData(request, params))({ request }),
    },
  },
})
