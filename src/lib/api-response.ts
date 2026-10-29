import { HttpStatus, isServerError, MessageCode } from '@lst97-oss/last-httprism'
import { z } from 'zod'

const INTERNAL_ERROR_MESSAGE = 'Something went wrong. Please try again.'

const dataEnvelope = z.object({ data: z.unknown() })
const errorEnvelope = z.object({
  error: z.object({ code: z.string().optional(), message: z.string().optional() }),
})

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId?: string,
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

function fallbackMessage(status: number): string {
  if (status === HttpStatus.UNAUTHORIZED.code) return 'Sign in to continue.'
  if (status === HttpStatus.FORBIDDEN.code) return 'You do not have permission to do that.'
  if (status === HttpStatus.NOT_FOUND.code) return 'The requested resource was not found.'
  if (status === HttpStatus.TOO_MANY_REQUESTS.code) return 'Too many requests. Please try again shortly.'
  if (status === HttpStatus.SERVICE_UNAVAILABLE.code) return 'The service is temporarily unavailable. Please try again.'
  return isServerError(status) ? INTERNAL_ERROR_MESSAGE : 'Request failed. Please check the information and try again.'
}

// Reads the `{ data }` envelope every API route returns and turns `{ error }` into
// a typed throw, so pages only handle the happy path plus one catch.
export async function readApiData<T>(response: Response): Promise<T> {
  const raw: unknown = await response.json().catch(() => undefined)
  const requestId = response.headers.get('x-request-id') ?? undefined

  if (!response.ok) {
    const error = errorEnvelope.safeParse(raw).data?.error
    const code = error?.code ?? (isServerError(response.status) ? MessageCode.INTERNAL_ERROR.code : 'HTTP_ERROR')
    const canUseServerMessage =
      !isServerError(response.status) || response.status === HttpStatus.SERVICE_UNAVAILABLE.code
    const message = canUseServerMessage && error?.message ? error.message : fallbackMessage(response.status)
    throw new ApiRequestError(message, response.status, code, requestId)
  }

  const envelope = dataEnvelope.safeParse(raw)
  if (!envelope.success) {
    throw new ApiRequestError(
      'The server returned an invalid response. Please try again.',
      response.status,
      'INVALID_RESPONSE',
      requestId,
    )
  }
  return envelope.data.data as T
}

export function isUnauthenticatedError(error: unknown): error is ApiRequestError {
  return (
    error instanceof ApiRequestError &&
    (error.status === HttpStatus.UNAUTHORIZED.code || error.code === MessageCode.UNAUTHORIZED.code)
  )
}

export function describeApiError(cause: unknown, fallback: string) {
  const request = cause instanceof ApiRequestError ? cause : null
  return {
    message: request?.message ?? (cause instanceof Error ? cause.message : fallback),
    needsSignIn: isUnauthenticatedError(cause),
    forbidden: request?.status === HttpStatus.FORBIDDEN.code,
    requestId: request ? (request.requestId ?? '') : '',
  }
}
