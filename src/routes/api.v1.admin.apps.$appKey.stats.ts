import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { getAppStatsData } from '@/server/modules/admin/http/admin-stats'

export const Route = createFileRoute('/api/v1/admin/apps/$appKey/stats')({
  server: {
    handlers: {
      GET: ({ request, params }) => withContext(async () => getAppStatsData(request, params.appKey))({ request }),
    },
  },
})
