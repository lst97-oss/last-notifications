import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { retryDeliveryData } from '@/server/modules/admin/http/admin-deliveries'

// Resets a dead letter to a fresh attempt; the worker picks it up on its next poll.
export const Route = createFileRoute('/api/v1/admin/deliveries/$id/retry')({
  server: {
    handlers: {
      POST: ({ request, params }) => withContext(async () => retryDeliveryData(request, params))({ request }),
    },
  },
})
