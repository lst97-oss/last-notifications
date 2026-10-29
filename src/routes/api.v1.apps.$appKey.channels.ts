import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { getChannelsData } from '@/server/modules/notifications/http/channel-config-handler'

// Host-facing read of this app's delivery settings. Never returns a secret.
export const Route = createFileRoute('/api/v1/apps/$appKey/channels')({
  server: {
    handlers: {
      GET: ({ request, params }) => withContext(async () => getChannelsData(request, params))({ request }),
    },
  },
})
