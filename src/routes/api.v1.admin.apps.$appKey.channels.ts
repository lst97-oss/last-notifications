import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { getAppChannelsData, patchAppChannelData } from '@/server/modules/admin/http/admin-apps'

// Per-app channel switches and non-secret tuning; secrets stay in the environment.
export const Route = createFileRoute('/api/v1/admin/apps/$appKey/channels')({
  server: {
    handlers: {
      GET: ({ request, params }) => withContext(async () => getAppChannelsData(request, params))({ request }),
      PATCH: ({ request, params }) => withContext(async () => patchAppChannelData(request, params))({ request }),
    },
  },
})
