import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { createAppData, listAppsData } from '@/server/modules/admin/http/admin-apps'

// Session dashboard users see the apps they administer; an unbound apps:* service
// key is the machine path.
export const Route = createFileRoute('/api/v1/admin/apps')({
  server: {
    handlers: {
      GET: ({ request }) => withContext(async () => listAppsData(request))({ request }),
      POST: ({ request }) => withContext(async () => createAppData(request))({ request }),
    },
  },
})
