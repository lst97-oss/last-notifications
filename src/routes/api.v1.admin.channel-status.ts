import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { channelStatusData } from '@/server/modules/admin/http/admin-apps'

// Self-describing plugin status: enablement and a human detail string, never a secret.
export const Route = createFileRoute('/api/v1/admin/channel-status')({
  server: {
    handlers: {
      GET: ({ request }) => withContext(async () => channelStatusData(request))({ request }),
    },
  },
})
