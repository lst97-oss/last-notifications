import { HttpStatus } from '@lst97-oss/last-httprism'
import { applyCors } from '@/server/http/cors'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { fail } from '@/server/http/response'
import { type AppRecord, appOriginAllowed, getAppByKey } from '@/server/modules/apps/infrastructure/app-repository'

// A consuming site's browser is cross-origin here. Echo only an origin that is
// registered for this app; a missing Origin (curl, native client) is fine.
export async function resolveNotificationOrigin(app: AppRecord, request: Request): Promise<string | null> {
  const origin = request.headers.get('origin')
  if (!origin) return null
  if (!(await appOriginAllowed(app.key, origin))) {
    throw new HttpError(ErrorCode.ORIGIN_NOT_ALLOWED, 'This origin is not registered for the app')
  }
  return origin
}

// An unknown app is left for the route's own 404, not a CORS failure.
async function resolveOrigin(appKey: string, request: Request): Promise<string | null> {
  const app = await getAppByKey(appKey)
  return app ? resolveNotificationOrigin(app, request) : null
}

// Wraps the route handler so success and error responses carry the same CORS
// headers the SSE stream sends.
export async function withNotificationCors(
  request: Request,
  appKey: string,
  methods: string,
  run: () => Promise<Response>,
): Promise<Response> {
  let origin: string | null
  try {
    origin = await resolveOrigin(appKey, request)
  } catch (error) {
    return fail(error)
  }
  return applyCors(await run(), origin, methods)
}

export async function notificationPreflight(request: Request, appKey: string, methods: string): Promise<Response> {
  try {
    const origin = await resolveOrigin(appKey, request)
    const response = applyCors(new Response(null, { status: HttpStatus.NO_CONTENT.code }), origin, methods)
    // Browsers otherwise cache a preflight for only a few seconds.
    response.headers.set('access-control-max-age', '600')
    return response
  } catch (error) {
    return fail(error)
  }
}
