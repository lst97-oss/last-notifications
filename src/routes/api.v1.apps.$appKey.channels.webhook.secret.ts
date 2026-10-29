import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { rotateWebhookSecretData } from '@/server/modules/notifications/http/channel-config-handler'

// Rotates this app's webhook signing secret. The new secret is returned once; the old one stops working.
export const Route = createFileRoute('/api/v1/apps/$appKey/channels/webhook/secret')({
  server: {
    handlers: {
      POST: ({ request, params }) => withContext(async () => rotateWebhookSecretData(request, params))({ request }),
    },
  },
})
