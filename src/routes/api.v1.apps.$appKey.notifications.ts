import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { publishNotificationData } from '@/server/modules/notifications/http/notification-handler'

// Server-to-server publish. A bound `notifications:create` key names the recipient
// and the channels; the inbox row plus one outbox row per async channel land in
// one transaction, then the stream fan-out runs after commit.
export const Route = createFileRoute('/api/v1/apps/$appKey/notifications')({
  server: {
    handlers: {
      POST: ({ request, params }) => withContext(async () => publishNotificationData(request, params))({ request }),
    },
  },
})
