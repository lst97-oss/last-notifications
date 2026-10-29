import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { putWebhookChannelData } from '@/server/modules/notifications/http/channel-config-handler'

// Sets this app's webhook endpoint (null clears it). The first call also issues the signing secret.
export const Route = createFileRoute('/api/v1/apps/$appKey/channels/webhook')({
  server: {
    handlers: {
      PUT: ({ request, params }) => withContext(async () => putWebhookChannelData(request, params))({ request }),
    },
  },
})
