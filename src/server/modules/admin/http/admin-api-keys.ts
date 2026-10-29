import { HttpStatus } from '@lst97-oss/last-httprism'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { ok } from '@/server/http/response'
import { assertSameOrigin, isAppAdmin } from '@/server/http/route-guards'
import { parseJsonBody, parseSearchParams, parseWith } from '@/server/http/validation'
import { keyCreateSchema, keyDeleteQuerySchema, keyUpdateSchema } from '@/server/modules/admin/http/admin-schemas'
import { requireDashboardUser } from '@/server/modules/admin/http/dashboard-guard'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'
import {
  deleteServiceKey,
  issueServiceKey,
  listOwnedServiceKeys,
  readServiceKey,
  scopesToPermissions,
  updateServiceKeyValues,
} from '@/server/modules/api-keys/infrastructure/api-key-repository'
import { getAppId } from '@/server/modules/apps/infrastructure/app-repository'

// An app key needs that app's admin; an instance key (no app binding) needs the
// instance admin. Returned so the caller knows which binding was authorized.
async function requireScopeManager(userId: string, appKey: string | undefined): Promise<string | null> {
  if (!appKey) {
    if (!(await hasInstanceAdmin(userId))) {
      throw new HttpError(ErrorCode.FORBIDDEN, 'Only an instance admin can manage instance keys')
    }
    return null
  }
  const appId = await getAppId(appKey)
  if (!appId) throw new HttpError(ErrorCode.APP_NOT_FOUND)
  if (!(await isAppAdmin(appId, userId))) {
    throw new HttpError(ErrorCode.FORBIDDEN, 'Only an admin of this app can manage its keys')
  }
  return appKey
}

// Key management is owner-scoped: callers see and change their own keys, instance
// admins additionally manage anyone's. The app binding must match so a key cannot
// be touched from outside its scope.
async function requireManagedKey(userId: string, keyId: string, appKey: string | undefined) {
  const existing = await readServiceKey(keyId)
  if (!existing || (existing.metadata?.app ?? null) !== (appKey ?? null)) {
    throw new HttpError(ErrorCode.API_KEY_NOT_FOUND)
  }
  if (existing.actorUserId !== userId && !(await hasInstanceAdmin(userId))) {
    throw new HttpError(ErrorCode.FORBIDDEN, 'Only the key owner or an instance admin can change this key')
  }
  return existing
}

export async function listKeysData(request: Request): Promise<Response> {
  const userId = await requireDashboardUser(request, 'Sign in to manage API keys')
  return ok({ keys: await listOwnedServiceKeys(userId) })
}

export async function createKeyData(request: Request): Promise<Response> {
  assertSameOrigin(request, 'Key creation must use the application origin')
  const userId = await requireDashboardUser(request, 'Sign in to manage API keys')
  const body = await parseJsonBody(request, keyCreateSchema)
  const appKey = await requireScopeManager(userId, body.appKey)
  const created = await issueServiceKey({
    userId,
    name: body.name,
    appKey,
    scopes: body.scopes,
    expiresIn: body.expiresIn,
    rateLimit: body.rateLimit,
  })
  // The secret is in this response once; it is never listed again.
  return ok({ id: created.id, key: created.key, name: created.name, appKey }, { status: HttpStatus.CREATED.code })
}

export async function updateKeyData(request: Request): Promise<Response> {
  assertSameOrigin(request, 'Key changes must use the application origin')
  const userId = await requireDashboardUser(request, 'Sign in to manage API keys')
  const body = await parseJsonBody(request, keyUpdateSchema)
  await requireManagedKey(userId, body.keyId, body.appKey)
  await updateServiceKeyValues(body.keyId, {
    ...(body.scopes ? { permissions: scopesToPermissions(body.scopes) } : {}),
    ...(body.enabled === undefined ? {} : { enabled: body.enabled }),
  })
  return ok({ updated: true })
}

export async function deleteKeyData(request: Request): Promise<Response> {
  assertSameOrigin(request, 'Key deletion must use the application origin')
  const userId = await requireDashboardUser(request, 'Sign in to manage API keys')
  const { keyId, appKey } = parseSearchParams(request.url, keyDeleteQuerySchema)
  await requireManagedKey(userId, parseWith(keyDeleteQuerySchema.shape.keyId, keyId), appKey)
  await deleteServiceKey(keyId)
  return ok({ deleted: true })
}
