import { HttpStatus } from '@lst97-oss/last-httprism'
import { HttpError, toHttpError } from '@/server/http/errors'

function mergeHeaders(init?: { headers?: HeadersInit }): Headers {
  const headers = new Headers({ 'cache-control': 'no-store' })
  if (init?.headers) {
    for (const [key, value] of new Headers(init.headers)) {
      headers.set(key, value)
    }
  }
  return headers
}

export function ok<T>(data: T, init?: { status?: number; headers?: HeadersInit }): Response {
  return Response.json({ data }, { status: init?.status ?? HttpStatus.OK.code, headers: mergeHeaders(init) })
}

export function fail(error: unknown, init?: { headers?: HeadersInit }): Response {
  const httpError = toHttpError(error)
  const message =
    httpError instanceof HttpError && httpError.expose ? httpError.message : HttpStatus.INTERNAL_SERVER_ERROR.phrase
  return Response.json(
    { error: { code: httpError.code, message } },
    { status: httpError.status, headers: mergeHeaders(init) },
  )
}
