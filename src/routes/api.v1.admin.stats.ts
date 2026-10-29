import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { getFleetStatsData } from '@/server/modules/admin/http/admin-stats'

export const Route = createFileRoute('/api/v1/admin/stats')({
  server: {
    handlers: {
      GET: ({ request }) => withContext(async () => getFleetStatsData(request))({ request }),
    },
  },
})
