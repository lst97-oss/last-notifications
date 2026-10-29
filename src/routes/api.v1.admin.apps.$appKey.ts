import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { deleteAppData, updateAppData } from '@/server/modules/admin/http/admin-apps'

export const Route = createFileRoute('/api/v1/admin/apps/$appKey')({
  server: {
    handlers: {
      PATCH: ({ request, params }) => withContext(async () => updateAppData(request, params))({ request }),
      DELETE: ({ request, params }) => withContext(async () => deleteAppData(request, params))({ request }),
    },
  },
})
