import { eq } from 'drizzle-orm'

import { API_KEY_SCOPES, APP_SCOPES, type ApiKeyScope } from '@/lib/api-key-scopes'
import type { ApiKeyRecord } from '@/lib/api-keys'
import { getBusinessAuth } from '@/server/auth/business-auth'
import { type BusinessDb, getBusinessDb } from '@/server/db/business-sql'
import { apiKeyApps, apikey, apps } from '@/server/db/schema'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { getAppId } from '@/server/modules/apps/infrastructure/app-repository'

export { API_KEY_SCOPES, type ApiKeyScope }

// A scope is `resource:verb`, and the stored form is the plugin's `{resource: [verbs]}`.
const SCOPE_TO_PERMISSION = Object.fromEntries(
  API_KEY_SCOPES.map((scope) => {
    const [resource = '', action = ''] = scope.split(':')
    return [scope, { resource, action }]
  }),
) as Record<ApiKeyScope, { resource: string; action: string }>

export const DEFAULT_RATE_LIMIT = { windowMs: 60_000, max: 600 } as const

export function scopesToPermissions(scopes: ApiKeyScope[]): Record<string, string[]> {
  const permissions: Record<string, string[]> = {}
  for (const scope of scopes) {
    const { resource, action } = SCOPE_TO_PERMISSION[scope]
    const actions = permissions[resource] ?? []
    if (!actions.includes(action)) actions.push(action)
    permissions[resource] = actions
  }
  return permissions
}

export type ResolvedServiceKey = {
  id: string
  appKey: string | null
  appId: string | null
  name: string | null
  actorUserId: string
  scopes: ApiKeyScope[]
}

const PERMISSION_TO_SCOPE: Record<string, ApiKeyScope> = Object.fromEntries(
  Object.entries(SCOPE_TO_PERMISSION).map(([scope, { resource, action }]) => [`${resource}:${action}`, scope]),
) as Record<string, ApiKeyScope>

export function permissionsToScopes(permissions: unknown): ApiKeyScope[] {
  if (!permissions) return []
  let map: unknown = permissions
  if (typeof permissions === 'string') {
    try {
      map = JSON.parse(permissions)
    } catch {
      return []
    }
  }
  if (typeof map !== 'object' || map === null || Array.isArray(map)) return []
  const scopes: ApiKeyScope[] = []
  for (const [resource, actions] of Object.entries(map as Record<string, unknown>)) {
    if (!Array.isArray(actions)) continue
    for (const action of actions) {
      if (typeof action !== 'string') continue
      const scope = PERMISSION_TO_SCOPE[`${resource}:${action}`]
      if (scope && !scopes.includes(scope)) scopes.push(scope)
    }
  }
  return scopes
}

// The app a key is bound to. Null for an instance key.
export async function boundAppKeyOf(keyId: string, db: BusinessDb = getBusinessDb()): Promise<string | null> {
  const [row] = await db
    .select({ key: apps.key })
    .from(apiKeyApps)
    .innerJoin(apps, eq(apps.id, apiKeyApps.appId))
    .where(eq(apiKeyApps.apiKeyId, keyId))
    .limit(1)
  return row?.key ?? null
}

// Service keys live in `x-api-key` or in `Authorization`. Only the `lnk_` prefix
// marks an Authorization header as a service key, so an unrelated bearer token
// falls through to the session adapters instead of key verification.
const API_KEY_PREFIX = 'lnk_'

function extractBearer(request: Request): string | null {
  const explicit = request.headers.get('x-api-key')?.trim()
  if (explicit) return explicit
  const raw = request.headers.get('authorization')?.trim()
  if (!raw) return null
  const secret = /^bearer\s+/i.test(raw) ? raw.replace(/^bearer\s+/i, '').trim() : raw
  return secret.startsWith(API_KEY_PREFIX) ? secret : null
}

export function hasServiceKey(request: Request): boolean {
  return extractBearer(request) !== null
}

// Verify + permission-check in one call: the plugin checks the permissions map,
// and the app binding comes from api_key_apps. A key that needs an app but has no
// binding is refused, so a half-created key cannot act on an instance route either.
export async function requireServiceKey(
  request: Request,
  scope: ApiKeyScope,
  appKey?: string,
): Promise<ResolvedServiceKey> {
  const secret = extractBearer(request)
  if (!secret) throw new HttpError(ErrorCode.INVALID_API_KEY, 'API key is required')
  const { resource, action } = SCOPE_TO_PERMISSION[scope]
  const result = await getBusinessAuth().api.verifyApiKey({
    body: { key: secret, permissions: { [resource]: [action] } },
  })
  if (!result.valid || !result.key) {
    if (result.error?.code === 'RATE_LIMITED') throw new HttpError(ErrorCode.RATE_LIMITED)
    if (result.error?.code === 'KEY_NOT_FOUND') {
      throw new HttpError(ErrorCode.INSUFFICIENT_SCOPE, 'API key lacks the required permission')
    }
    // Expired, disabled and unknown keys all read as invalid to the caller.
    throw new HttpError(ErrorCode.INVALID_API_KEY)
  }
  const boundAppKey = await boundAppKeyOf(result.key.id)
  if (boundAppKey === null && APP_SCOPES.includes(scope)) {
    throw new HttpError(ErrorCode.INSUFFICIENT_SCOPE, 'API key is not bound to an app')
  }
  if (boundAppKey !== (appKey ?? null)) {
    throw new HttpError(ErrorCode.INSUFFICIENT_SCOPE, 'API key is not authorized for this app')
  }
  return {
    id: result.key.id,
    appKey: boundAppKey,
    appId: boundAppKey === null ? null : await getAppId(boundAppKey),
    name: result.key.name,
    actorUserId: result.key.referenceId,
    scopes: permissionsToScopes(result.key.permissions),
  }
}

// Server-side key issuance: permissions and the app binding are set here, never
// from client input. Must run headerless: the plugin rejects server-only fields
// (permissions) whenever request headers are present.
export async function issueServiceKey(input: {
  userId: string
  name: string
  appKey: string | null
  scopes: ApiKeyScope[]
  // Seconds until the key expires; omitted means it never does.
  expiresIn?: number
  rateLimit?: { windowMs: number; max: number }
}) {
  const rate = input.rateLimit ?? DEFAULT_RATE_LIMIT
  const db = getBusinessDb()
  // Resolve the app before the key exists, so an unknown app creates nothing.
  const appId = input.appKey ? await getAppId(input.appKey, db) : null
  if (input.appKey && !appId) throw new HttpError(ErrorCode.APP_NOT_FOUND)

  const created = await getBusinessAuth().api.createApiKey({
    body: {
      userId: input.userId,
      name: input.name,
      prefix: API_KEY_PREFIX,
      permissions: scopesToPermissions(input.scopes),
      rateLimitEnabled: true,
      rateLimitTimeWindow: rate.windowMs,
      rateLimitMax: rate.max,
      ...(input.expiresIn ? { expiresIn: input.expiresIn } : {}),
    },
  })
  if (appId) {
    try {
      await db.insert(apiKeyApps).values({ apiKeyId: created.id, appId })
    } catch (error) {
      // A key without its binding is refused, so the key is removed rather than left behind.
      await db.delete(apikey).where(eq(apikey.id, created.id))
      throw error
    }
  }
  return created
}

// Provider-neutral reads/writes straight against our own apikey table. The
// plugin's /api-key/* endpoints resolve the caller from a session cookie, so they
// cannot serve every dashboard flow; these helpers run under the route's own
// session guard instead. Storage format matches the plugin exactly (permissions
// as JSON text), so both paths see the same keys.
function parseKeyPermissions(permissions: string | null): Record<string, string[]> | null {
  if (!permissions) return null
  try {
    const parsed: unknown = JSON.parse(permissions)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    const result: Record<string, string[]> = {}
    for (const [resource, actions] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(actions)) {
        result[resource] = actions.filter((action): action is string => typeof action === 'string')
      }
    }
    return result
  } catch {
    return null
  }
}

export function toPluginKey(row: {
  id: string
  name: string | null
  start: string | null
  prefix: string | null
  enabled: boolean | null
  expiresAt: Date | null
  lastRequest: Date | null
  createdAt: Date
  appKey: string | null
  permissions: string | null
}): ApiKeyRecord {
  return {
    id: row.id,
    name: row.name,
    start: row.start,
    prefix: row.prefix,
    enabled: row.enabled ?? true,
    expiresAt: row.expiresAt,
    lastRequest: row.lastRequest,
    createdAt: row.createdAt,
    metadata: row.appKey === null ? null : { app: row.appKey },
    permissions: parseKeyPermissions(row.permissions),
  }
}

export type OwnedServiceKey = ApiKeyRecord & { actorUserId: string }

const keyColumns = {
  id: apikey.id,
  name: apikey.name,
  start: apikey.start,
  prefix: apikey.prefix,
  enabled: apikey.enabled,
  expiresAt: apikey.expiresAt,
  lastRequest: apikey.lastRequest,
  createdAt: apikey.createdAt,
  permissions: apikey.permissions,
  appKey: apps.key,
}

export async function listOwnedServiceKeys(userId: string, db: BusinessDb = getBusinessDb()): Promise<ApiKeyRecord[]> {
  const rows = await db
    .select(keyColumns)
    .from(apikey)
    .leftJoin(apiKeyApps, eq(apiKeyApps.apiKeyId, apikey.id))
    .leftJoin(apps, eq(apps.id, apiKeyApps.appId))
    .where(eq(apikey.referenceId, userId))
    .orderBy(apikey.createdAt)
  return rows.map(toPluginKey)
}

export async function readServiceKey(keyId: string, db: BusinessDb = getBusinessDb()): Promise<OwnedServiceKey | null> {
  const [row] = await db
    .select({ ...keyColumns, actorUserId: apikey.referenceId })
    .from(apikey)
    .leftJoin(apiKeyApps, eq(apiKeyApps.apiKeyId, apikey.id))
    .leftJoin(apps, eq(apps.id, apiKeyApps.appId))
    .where(eq(apikey.id, keyId))
    .limit(1)
  return row ? { ...toPluginKey(row), actorUserId: row.actorUserId } : null
}

export async function updateServiceKeyValues(
  keyId: string,
  patch: { permissions?: Record<string, string[]>; enabled?: boolean },
  db: BusinessDb = getBusinessDb(),
): Promise<void> {
  await db
    .update(apikey)
    .set({
      ...(patch.permissions ? { permissions: JSON.stringify(patch.permissions) } : {}),
      ...(patch.enabled === undefined ? {} : { enabled: patch.enabled }),
    })
    .where(eq(apikey.id, keyId))
}

export async function deleteServiceKey(keyId: string, db: BusinessDb = getBusinessDb()): Promise<void> {
  await db.delete(apikey).where(eq(apikey.id, keyId))
}
