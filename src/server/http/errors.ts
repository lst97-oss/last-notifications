import { defineMessageCodes, HttpStatus, isServerError, type MessageCodeInfo } from '@lst97-oss/last-httprism'

// Every error the app raises comes from this table. The package's standard codes
// (ErrorCode.FORBIDDEN, ErrorCode.NOT_FOUND, ...) are merged in; app codes keep their
// wire names and take their status from the package. A call site passes its own
// message only when the text is specific to that check.
export const ErrorCode = defineMessageCodes({
  VALIDATION_ERROR: { status: HttpStatus.BAD_REQUEST.code, message: 'invalid input' },
  MALFORMED_JSON: { status: HttpStatus.BAD_REQUEST.code, message: 'request body is not valid JSON' },
  BODY_TOO_LARGE: { status: HttpStatus.CONTENT_TOO_LARGE.code, message: 'request body is too large' },
  ADMIN_SIGNUP_FAILED: { status: HttpStatus.BAD_REQUEST.code, message: 'Could not create the initial admin account' },
  INVALID_API_KEY: { status: HttpStatus.UNAUTHORIZED.code, message: 'API key is invalid, revoked, or expired' },
  INVALID_RECIPIENT_TOKEN: { status: HttpStatus.UNAUTHORIZED.code, message: 'Recipient token is invalid or expired' },
  RATE_LIMITED: { status: HttpStatus.TOO_MANY_REQUESTS.code, message: 'Too many requests for this API key' },
  SETUP_UNAVAILABLE: { status: HttpStatus.FORBIDDEN.code, message: 'Initial admin setup has already been used' },
  APP_NOT_FOUND: { status: HttpStatus.NOT_FOUND.code, message: 'App was not found' },
  API_KEY_NOT_FOUND: { status: HttpStatus.NOT_FOUND.code, message: 'API key was not found' },
  DELIVERY_NOT_FOUND: { status: HttpStatus.NOT_FOUND.code, message: 'Delivery was not found' },
  DELIVERY_NOT_RETRYABLE: {
    status: HttpStatus.CONFLICT.code,
    message: 'Only a dead-letter delivery can be retried',
  },
  NOTIFICATION_NOT_FOUND: { status: HttpStatus.NOT_FOUND.code, message: 'Notification was not found' },
  WEBPUSH_NOT_CONFIGURED: {
    status: HttpStatus.SERVICE_UNAVAILABLE.code,
    message: 'Web Push is not configured on this server',
  },
  SECRET_ENCRYPTION_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE.code,
    message: 'Per-app secrets are not configured on this server',
  },
  OPENAPI_DISABLED: { status: HttpStatus.NOT_FOUND.code, message: 'OpenAPI docs are disabled' },
})

export class HttpError extends Error {
  status: number
  code: string
  expose: boolean

  constructor(error: MessageCodeInfo, message = error.message, options?: { expose?: boolean }) {
    super(message)
    this.status = error.status
    this.code = error.code
    this.expose = options?.expose ?? !isServerError(error.status)
  }
}

export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new HttpError(ErrorCode.INTERNAL_ERROR, message, { expose: false })
}
