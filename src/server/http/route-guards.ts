import { and, eq } from 'drizzle-orm'
import { resolvePayloadServerUrl } from '@/payload/security/payload-server-url'
import { type Principal, resolveSessionPrincipal } from '@/server/auth/resolve'
import { getBusinessDb } from '@/server/db/business-sql'
import { appMemberships } from '@/server/db/schema'
import { getServerEnv } from '@/server/env'
import { ErrorCode, HttpError } from '@/server/http/errors'

// Pure so the rule can be tested without the environment. `publicOrigin` is the
// configured public origin, accepted alongside the request's own origin.
export function isAllowedOrigin(origin: string | null, requestUrl: string, publicOrigin: string | undefined): boolean {
  if (!origin) return false
  try {
    const candidate = new URL(origin).origin
    const allowed = [new URL(requestUrl).origin, publicOrigin && new URL(publicOrigin).origin]
    return allowed.includes(candidate)
  } catch {
    return false
  }
}

export function configuredPublicOrigin(): string | undefined {
  try {
    return resolvePayloadServerUrl(getServerEnv())
  } catch {
    return undefined
  }
}

export function assertSameOrigin(request: Request, message: string): void {
  // Behind the TLS-terminating ingress the request URL is http://, so the
  // configured public origin is checked too.
  if (isAllowedOrigin(request.headers.get('origin'), request.url, configuredPublicOrigin())) return
  throw new HttpError(ErrorCode.ORIGIN_NOT_ALLOWED, message)
}

export async function requirePrincipal(request: Request, message: string): Promise<Principal> {
  const principal = await resolveSessionPrincipal(request)
  if (!principal) throw new HttpError(ErrorCode.UNAUTHORIZED, message)
  return principal
}

export async function requireSessionUserId(request: Request, message: string): Promise<string> {
  return (await requirePrincipal(request, message)).userId
}

export async function getAppRole(appId: string, userId: string): Promise<'admin' | 'member' | null> {
  const [membership] = await getBusinessDb()
    .select({ role: appMemberships.role })
    .from(appMemberships)
    .where(and(eq(appMemberships.appId, appId), eq(appMemberships.userId, userId)))
    .limit(1)
  return membership?.role ?? null
}

// App management and subscriber data are admin-only; any membership is not enough.
export async function isAppAdmin(appId: string, userId: string): Promise<boolean> {
  return (await getAppRole(appId, userId)) === 'admin'
}
