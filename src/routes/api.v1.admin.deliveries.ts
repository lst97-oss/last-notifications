import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { listDeliveriesData } from '@/server/modules/admin/http/admin-deliveries'

export const Route = createFileRoute('/api/v1/admin/deliveries')({
  server: {
    handlers: {
      GET: ({ request }) => withContext(async () => listDeliveriesData(request))({ request }),
    },
  },
})
