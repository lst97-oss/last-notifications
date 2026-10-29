import { HttpStatus } from '@lst97-oss/last-httprism'
import { ErrorCode, HttpError, toHttpError } from '@/server/http/errors'
import { fail, ok } from '@/server/http/response'
import { getRequestLogger, type Logger } from '@/server/observability/logger'

export type RequestContext = { requestId: string; logger: Logger; startedAt: number }

export type ContextHandler<T = unknown> = (ctx: RequestContext) => Promise<T>

export type StartRouteCtx = { request: Request }

function safeLog(write: () => void): void {
  try {
    write()
  } catch {
    // Logging must never break the request path.
  }
}

export function withContext<T>(
  handler: ContextHandler<T>,
  options?: { logger?: Logger },
): (ctx: StartRouteCtx) => Promise<Response> {
  return async ({ request }: StartRouteCtx): Promise<Response> => {
    let requestId: string
    try {
      const inbound = request.headers.get('x-request-id')
      requestId = inbound && inbound.length > 0 ? inbound : crypto.randomUUID()
    } catch {
      requestId = `fallback-${Date.now()}`
    }

    try {
      const logger = (options?.logger ?? getRequestLogger()).child({ requestId })
      const startedAt = Date.now()

      let path = '/'
      try {
        path = new URL(request.url).pathname
      } catch {
        // Keep default path when URL parsing fails.
      }
      safeLog(() => logger.info('request.start', { requestId, method: request.method, path }))

      try {
        const result = await handler({ requestId, logger, startedAt })
        // Handlers that already build a Response (ready: 200|503) pass
        // through — only plain data gets the ok() envelope.
        const response = result instanceof Response ? result : ok(result)
        response.headers.set('x-request-id', requestId)
        safeLog(() =>
          logger.info('request.complete', {
            requestId,
            status: response.status,
            latencyMs: Date.now() - startedAt,
          }),
        )
        return response
      } catch (error) {
        const httpError = toHttpError(error)
        safeLog(() =>
          logger.error('request.error', {
            requestId,
            code: httpError.code,
            status: httpError.status,
            message: httpError.message,
          }),
        )
        try {
          const response = fail(httpError)
          response.headers.set('x-request-id', requestId)
          return response
        } catch {
          return new Response(HttpStatus.INTERNAL_SERVER_ERROR.phrase, {
            status: HttpStatus.INTERNAL_SERVER_ERROR.code,
            headers: { 'cache-control': 'no-store', 'x-request-id': requestId },
          })
        }
      }
    } catch {
      try {
        const response = fail(new Error('request failed'))
        response.headers.set('x-request-id', requestId)
        return response
      } catch {
        return new Response(HttpStatus.INTERNAL_SERVER_ERROR.phrase, { status: HttpStatus.INTERNAL_SERVER_ERROR.code })
      }
    }
  }
}

export function withAuth(
  _handler: ContextHandler,
  options?: { logger?: Logger },
): (ctx: StartRouteCtx) => Promise<Response> {
  void _handler
  void options
  return async ({ request }: StartRouteCtx): Promise<Response> => {
    const inbound = request.headers.get('x-request-id')
    const requestId = inbound && inbound.length > 0 ? inbound : crypto.randomUUID()
    const response = fail(new HttpError(ErrorCode.NOT_IMPLEMENTED, 'Authentication is not wired yet', { expose: true }))
    response.headers.set('x-request-id', requestId)
    return response
  }
}
