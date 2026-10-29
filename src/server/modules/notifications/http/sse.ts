import type { NotificationRecord } from '@/server/modules/notifications/domain/notification'
import { toInboxItem } from '@/server/modules/notifications/http/inbox-item'

// Server-sent events: one long GET per open tab. `id:` is the same cursor the
// REST inbox returns, so a reconnect with Last-Event-ID resumes exactly where the
// client stopped. Keepalive comments keep proxies from closing an idle stream.
export const SSE_KEEPALIVE_MS = 25_000

export function encodeNotificationFrame(event: { cursor: string; notification: NotificationRecord }): string {
  return `event: notification\ndata: ${JSON.stringify(toInboxItem(event.notification))}\nid: ${event.cursor}\n\n`
}

export function encodeKeepaliveFrame(): string {
  return ': ping\n\n'
}

export function sseResponseHeaders(origin: string | null): Headers {
  const headers = new Headers({
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
    // nginx buffers proxied responses by default, which stalls a stream.
    'x-accel-buffering': 'no',
  })
  if (origin) {
    headers.set('access-control-allow-origin', origin)
    headers.set('access-control-allow-credentials', 'true')
    headers.set('vary', 'Origin')
  }
  return headers
}
