import { HttpStatus } from '@lst97-oss/last-httprism'
import type { ServerWebSocket } from 'bun'

import { closeBusinessSql } from '@/server/db/business-sql'
import { HttpError } from '@/server/http/errors'
import { appOriginAllowed, getAppByKey } from '@/server/modules/apps/infrastructure/app-repository'
import { encodeCursor } from '@/server/modules/notifications/domain/notification'
import { toInboxItem } from '@/server/modules/notifications/http/inbox-item'
import { listInboxItems } from '@/server/modules/notifications/infrastructure/notification-repository'
import { verifyRecipientToken } from '@/server/modules/notifications/infrastructure/recipient-token-repository'
import { startStreamBus } from '@/server/modules/notifications/infrastructure/stream-bus'
import { subscribeToRecipient } from '@/server/modules/notifications/infrastructure/stream-hub'
import { getRequestLogger } from '@/server/observability/logger'

// Standalone WebSocket gateway. The app process cannot own a WS upgrade: TanStack
// Start owns src/routes and the default Nitro dev/prod handler answers 500, so this
// sidecar serves the same wire contract as the SSE stream and receives fan-out from
// Postgres LISTEN/NOTIFY (the app publishes the same NOTIFY the bus delivers).
//
// Wire contract:
//   connect  ws://host:WS_PORT/api/v1/apps/<appKey>/ws?token=<recipient token>
//   server   {"type":"notification","cursor":"…","notification":{…}}
//   client   {"type":"resume","cursor":"…"}   replay after a reconnect
//   server   {"type":"ready"}                 connection accepted
//   close    4401 invalid/expired token, 4403 wrong app or origin, 1011 internal
export const WS_HEARTBEAT_MS = 30_000
const FAILED_PINGS_BEFORE_CLOSE = 2

type WsData = {
  appId: string
  appKey: string
  recipientKey: string
  expiresAt: Date
  expiry: ReturnType<typeof setTimeout> | null
  alive: boolean
  missedPings: number
  unsubscribe: (() => void) | null
}

const logger = getRequestLogger().child({ component: 'realtime-ws' })
const sockets = new Set<ServerWebSocket<WsData>>()

export function startRealtimeServer(port: number) {
  const server = Bun.serve<WsData, never>({
    port,
    async fetch(request, self) {
      const url = new URL(request.url)
      const match = url.pathname.match(/^\/api\/v1\/apps\/([^/]+)\/ws$/)
      if (!match) return new Response(HttpStatus.NOT_FOUND.phrase, { status: HttpStatus.NOT_FOUND.code })
      const appKey = decodeURIComponent(match[1] ?? '')

      const app = await getAppByKey(appKey).catch(() => null)
      if (!app) return new Response(HttpStatus.NOT_FOUND.phrase, { status: HttpStatus.NOT_FOUND.code })

      const origin = request.headers.get('origin')
      if (origin && !(await appOriginAllowed(app.key, origin))) {
        return new Response(HttpStatus.FORBIDDEN.phrase, { status: HttpStatus.FORBIDDEN.code })
      }

      const token = url.searchParams.get('token')?.trim() ?? bearerToken(request)
      const verified = token ? await verifyRecipientToken({ token, appId: app.id }) : null
      if (!verified) return new Response(HttpStatus.UNAUTHORIZED.phrase, { status: HttpStatus.UNAUTHORIZED.code })

      const upgraded = self.upgrade(request, {
        data: {
          appId: app.id,
          appKey: app.key,
          recipientKey: verified.recipientKey,
          expiresAt: verified.expiresAt,
          expiry: null,
          alive: true,
          missedPings: 0,
          unsubscribe: null,
        },
      })
      return upgraded ? undefined : new Response('Upgrade failed', { status: HttpStatus.BAD_REQUEST.code })
    },
    websocket: {
      open(ws) {
        sockets.add(ws)
        ws.data.unsubscribe = subscribeToRecipient(ws.data.appId, ws.data.recipientKey, (event) => {
          ws.send(
            JSON.stringify({
              type: 'notification',
              cursor: event.cursor,
              notification: toInboxItem(event.notification),
            }),
          )
        })
        // The token was checked at upgrade only; the socket closes with 4401 when it runs out.
        ws.data.expiry = setTimeout(
          () => ws.close(4401, 'token expired'),
          Math.max(0, ws.data.expiresAt.getTime() - Date.now()),
        )
        ws.send(JSON.stringify({ type: 'ready' }))
      },
      async message(ws, message) {
        const frame = parseFrame(message)
        if (!frame) return
        // Replay after a reconnect. The REST inbox is still the history API; this
        // only bridges the gap the client can prove it has.
        if (frame.type === 'resume' && typeof frame.cursor === 'string') {
          try {
            const page = await listInboxItems({
              appId: ws.data.appId,
              recipientKey: ws.data.recipientKey,
              since: frame.cursor,
              limit: 100,
            })
            for (const notification of page.items) {
              ws.send(
                JSON.stringify({
                  type: 'notification',
                  cursor: encodeCursor({ t: notification.createdAt, i: notification.id }),
                  notification: toInboxItem(notification),
                }),
              )
            }
          } catch (error) {
            logger.warn('ws.resume_failed', { message: describe(error) })
          }
          return
        }
        if (frame.type === 'pong') {
          ws.data.alive = true
          ws.data.missedPings = 0
        }
      },
      pong(ws) {
        ws.data.alive = true
        ws.data.missedPings = 0
      },
      close(ws, code) {
        sockets.delete(ws)
        clearTimeout(ws.data.expiry ?? undefined)
        ws.data.expiry = null
        ws.data.unsubscribe?.()
        ws.data.unsubscribe = null
        if (code === 1011) logger.warn('ws.closed_internal')
      },
      error(_ws, error) {
        logger.warn('ws.error', { message: describe(error) })
      },
    },
  })

  // A dead peer (closed browser, dropped network) never answers a ping; two missed
  // rounds close it so the hub's subscriber set cannot grow without bound.
  const heartbeat = setInterval(() => {
    for (const ws of sockets) {
      if (ws.data.alive) {
        ws.data.alive = false
        ws.data.missedPings = 0
        ws.ping()
        continue
      }
      ws.data.missedPings += 1
      if (ws.data.missedPings >= FAILED_PINGS_BEFORE_CLOSE) {
        ws.close(1001, 'heartbeat timeout')
        continue
      }
      ws.ping()
    }
  }, WS_HEARTBEAT_MS)

  const shutdown = () => {
    clearInterval(heartbeat)
    for (const ws of sockets) ws.close(1001, 'server shutting down')
    void server.stop(true)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  return server
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')?.trim()
  if (!header) return null
  const secret = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, '').trim() : header
  return secret.startsWith('lrt_') ? secret : null
}

function parseFrame(message: string | Buffer): { type?: unknown; cursor?: unknown } | null {
  try {
    const parsed: unknown = JSON.parse(typeof message === 'string' ? message : message.toString('utf8'))
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as { type?: unknown; cursor?: unknown }
  } catch {
    return null
  }
}

function describe(error: unknown): string {
  return error instanceof HttpError
    ? `${error.code}: ${error.message}`
    : error instanceof Error
      ? error.message
      : String(error)
}

const port = Number(Bun.env.WS_PORT ?? 3001)

// Cross-process fan-out: this process only listens; the app process publishes.
const listening = await startStreamBus()
if (!listening) {
  logger.error('ws.bus_unavailable', { detail: 'LISTEN failed; the sidecar will receive no notifications' })
  process.exit(1)
}

startRealtimeServer(port)
logger.info('ws.listening', { port })

process.on('SIGINT', () => void closeBusinessSql())
process.on('SIGTERM', () => void closeBusinessSql())
