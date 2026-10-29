import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { notificationPreflight } from '@/server/modules/notifications/http/notification-cors'
import { streamInboxData } from '@/server/modules/notifications/http/stream-handler'

// Long-lived SSE stream. Auth rides on the recipient token in a bearer header (the bell sends it
// that way); `?token=` remains for clients that cannot set headers. `Last-Event-ID` replays the
// gap, then live events follow on the same cursor the REST inbox returns.
export const Route = createFileRoute('/api/v1/apps/$appKey/stream')({
  server: {
    handlers: {
      GET: ({ request, params }) => withContext(async () => streamInboxData(request, params))({ request }),
      // A GET with an Authorization header is preflighted by browsers, so the stream answers OPTIONS too.
      OPTIONS: ({ request, params }) => notificationPreflight(request, params.appKey, 'GET, OPTIONS'),
    },
  },
})
