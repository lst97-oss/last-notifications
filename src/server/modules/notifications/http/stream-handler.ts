import { decodeCursor, encodeCursor } from '@/server/modules/notifications/domain/notification'
import { createLiveGate } from '@/server/modules/notifications/http/live-gate'
import { requireApp, requireInboxRecipient } from '@/server/modules/notifications/http/notification-access'
import { resolveNotificationOrigin } from '@/server/modules/notifications/http/notification-cors'
import {
  encodeKeepaliveFrame,
  encodeNotificationFrame,
  SSE_KEEPALIVE_MS,
  sseResponseHeaders,
} from '@/server/modules/notifications/http/sse'
import { listInboxItems } from '@/server/modules/notifications/infrastructure/notification-repository'
import { startStreamBus } from '@/server/modules/notifications/infrastructure/stream-bus'
import { subscribeToRecipient } from '@/server/modules/notifications/infrastructure/stream-hub'

// Catch-up is capped so a client with a very old cursor streams a bounded burst
// and then follows live: the REST inbox is the place to read history.
const CATCH_UP_PAGES = 10
const CATCH_UP_PAGE_SIZE = 100

export async function streamInboxData(request: Request, params: { appKey: string }): Promise<Response> {
  const app = await requireApp(params.appKey)
  const origin = await resolveNotificationOrigin(app, request)
  const caller = await requireInboxRecipient(request, app, { scope: 'notifications:read' })
  // A browser cannot set Last-Event-ID on a new EventSource, so the query form resumes it too.
  const since =
    request.headers.get('last-event-id')?.trim() ||
    new URL(request.url).searchParams.get('lastEventId')?.trim() ||
    undefined
  if (since) decodeCursor(since) // a bad cursor is a 400 here, not a broken stream after headers

  // Cross-process fan-out needs the LISTEN loop; a failure keeps the in-process hub.
  void startStreamBus()

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let keepalive: ReturnType<typeof setInterval> | undefined
  let expiry: ReturnType<typeof setTimeout> | undefined
  let stop = () => {}

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (frame: string) => {
        try {
          controller.enqueue(encoder.encode(frame))
        } catch {
          // The consumer already closed; cleanup happens on cancel/abort.
        }
      }

      let closed = false
      stop = () => {
        if (closed) return
        closed = true
        unsubscribe?.()
        unsubscribe = null
        clearInterval(keepalive)
        clearTimeout(expiry)
        try {
          controller.close()
        } catch {
          // Already closed by the peer.
        }
      }
      request.signal.addEventListener('abort', stop, { once: true })

      const gate = createLiveGate((event) => send(encodeNotificationFrame(event)))
      // Subscribe before the backlog is read. A publish that commits during the read is held by the
      // gate and sent live; subscribing afterwards would lose it.
      unsubscribe = subscribeToRecipient(app.id, caller.recipientKey, (event) => gate.live(event))

      let cursor = since
      for (let page = 0; page < CATCH_UP_PAGES && !closed; page += 1) {
        const items = await listInboxItems({
          appId: app.id,
          recipientKey: caller.recipientKey,
          since: cursor,
          limit: CATCH_UP_PAGE_SIZE,
        })
        for (const notification of items.items) {
          gate.backlog({ cursor: encodeCursor({ t: notification.createdAt, i: notification.id }), notification })
        }
        if (!items.next) break
        cursor = items.next
      }
      if (closed) return
      gate.open()
      keepalive = setInterval(() => send(encodeKeepaliveFrame()), SSE_KEEPALIVE_MS)
      // A token-backed stream ends when its token does; the client then needs a fresh token to reconnect.
      if (caller.expiresAt) {
        expiry = setTimeout(stop, Math.max(0, caller.expiresAt.getTime() - Date.now()))
      }
    },
    cancel() {
      stop()
    },
  })

  return new Response(stream, { headers: sseResponseHeaders(origin) })
}
