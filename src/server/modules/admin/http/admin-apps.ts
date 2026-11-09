import { HttpStatus } from '@lst97-oss/last-httprism'
import type { ApiKeyScope } from '@/lib/api-key-scopes'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { ok } from '@/server/http/response'
import { assertSameOrigin, isAppAdmin } from '@/server/http/route-guards'
import { parseJsonBody, parseWith } from '@/server/http/validation'
import {
  appCreateSchema,
  appKeySchema,
  appUpdateSchema,
  channelPatchSchema,
} from '@/server/modules/admin/http/admin-schemas'
import { requireDashboardUser } from '@/server/modules/admin/http/dashboard-guard'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'
import { hasServiceKey, requireServiceKey } from '@/server/modules/api-keys/infrastructure/api-key-repository'
import {
  createApp,
  deleteApp,
  getAppByKey,
  getAppChannelSettings,
  getAppId,
  listApps,
  listAppsForUser,
  setAppChannelSetting,
  updateApp,
} from '@/server/modules/apps/infrastructure/app-repository'
import { webhookUrlProblem } from '@/server/modules/notifications/domain/webhook-url'
import { webhookChannelBodySchema } from '@/server/modules/notifications/http/notification-schemas'
import { getNotificationChannels } from '@/server/plugins/config'
import { getWebhookPluginSettings } from '@/server/plugins/webhook/webhook.config'

// Session callers see the apps they administer (instance admins see all); an
// unbound service key with apps:read sees all too, which is the machine path.
async function listVisibleApps(userId: string) {
  if (await hasInstanceAdmin(userId)) return listApps()
  return listAppsForUser(userId)
}

async function requireAppAdmin(userId: string, appKey: string): Promise<void> {
  if (await hasInstanceAdmin(userId)) return
  const app = await getAppByKey(appKey)
  if (!app) throw new HttpError(ErrorCode.APP_NOT_FOUND)
  if (!(await isAppAdmin(app.id, userId))) {
    throw new HttpError(ErrorCode.FORBIDDEN, 'Only an admin of this app can change it')
  }
}

// apps:read, apps:update and apps:delete on an app key act on its own app only. An instance key
// manages any app.
async function requireAppsKey(request: Request, scope: ApiKeyScope, appKey?: string) {
  const key = await requireServiceKey(request, scope)
  if (key.appKey === null) return key
  if (appKey !== undefined && appKey !== key.appKey) {
    throw new HttpError(ErrorCode.INSUFFICIENT_SCOPE, 'API key is not authorized for this app')
  }
  return key
}

export async function listAppsData(request: Request): Promise<Response> {
  if (hasServiceKey(request)) {
    const key = await requireAppsKey(request, 'apps:read')
    const apps = await listApps()
    return ok({ apps: key.appKey === null ? apps : apps.filter((app) => app.key === key.appKey) })
  }
  const userId = await requireDashboardUser(request, 'Sign in to manage apps')
  return ok({ apps: await listVisibleApps(userId) })
}

export async function createAppData(request: Request): Promise<Response> {
  assertSameOrigin(request, 'App creation must use the application origin')
  // Apps are created from the dashboard only, so no key may create one.
  if (hasServiceKey(request)) {
    throw new HttpError(ErrorCode.INSUFFICIENT_SCOPE, 'Apps are created in the dashboard')
  }
  const userId = await requireDashboardUser(request, 'Sign in to manage apps')
  if (!(await hasInstanceAdmin(userId))) {
    throw new HttpError(ErrorCode.FORBIDDEN, 'Only an instance admin can create an app')
  }
  const body = await parseJsonBody(request, appCreateSchema)
  return ok(await createApp(userId, body), { status: HttpStatus.CREATED.code })
}

export async function updateAppData(request: Request, params: { appKey: string }): Promise<Response> {
  assertSameOrigin(request, 'App updates must use the application origin')
  const appKey = parseWith(appKeySchema, params.appKey)
  if (hasServiceKey(request)) {
    await requireAppsKey(request, 'apps:update', appKey)
    return ok(await updateApp(appKey, await parseJsonBody(request, appUpdateSchema)))
  }
  const userId = await requireDashboardUser(request, 'Sign in to manage apps')
  await requireAppAdmin(userId, appKey)
  return ok(await updateApp(appKey, await parseJsonBody(request, appUpdateSchema)))
}

export async function deleteAppData(request: Request, params: { appKey: string }): Promise<Response> {
  assertSameOrigin(request, 'App deletion must use the application origin')
  const appKey = parseWith(appKeySchema, params.appKey)
  if (hasServiceKey(request)) {
    await requireAppsKey(request, 'apps:delete', appKey)
    await deleteApp(appKey)
    return ok({ deleted: true })
  }
  const userId = await requireDashboardUser(request, 'Sign in to manage apps')
  if (!(await hasInstanceAdmin(userId))) {
    throw new HttpError(ErrorCode.FORBIDDEN, 'Only an instance admin can delete an app')
  }
  await deleteApp(appKey)
  return ok({ deleted: true })
}

export async function getAppChannelsData(request: Request, params: { appKey: string }): Promise<Response> {
  const appKey = parseWith(appKeySchema, params.appKey)
  if (hasServiceKey(request)) await requireAppsKey(request, 'apps:read', appKey)
  else await requireDashboardUser(request, 'Sign in to manage apps')
  const app = await getAppByKey(appKey)
  if (!app) throw new HttpError(ErrorCode.APP_NOT_FOUND)
  const settings = await getAppChannelSettings(app.id)
  return ok({
    channels: getNotificationChannels().map((channel) => {
      const status = channel.describe()
      const setting = settings[channel.channel]
      return {
        channel: channel.channel,
        installed: status.enabled,
        detail: status.detail,
        enabled: setting?.enabled ?? true,
        config: setting?.config ?? {},
        facts: status.facts,
      }
    }),
  })
}

export async function patchAppChannelData(request: Request, params: { appKey: string }): Promise<Response> {
  assertSameOrigin(request, 'Channel changes must use the application origin')
  const appKey = parseWith(appKeySchema, params.appKey)
  let userId: string | null = null
  if (hasServiceKey(request)) await requireAppsKey(request, 'apps:update', appKey)
  else {
    userId = await requireDashboardUser(request, 'Sign in to manage apps')
    await requireAppAdmin(userId, appKey)
  }
  const appId = await getAppId(appKey)
  if (!appId) throw new HttpError(ErrorCode.APP_NOT_FOUND)
  const body = await parseJsonBody(request, channelPatchSchema)
  // Keys switch channels on and off here. Config (a webhook address) is set by a dashboard user or the channels route.
  if (hasServiceKey(request) && body.config !== undefined) {
    throw new HttpError(ErrorCode.INSUFFICIENT_SCOPE, 'Channel settings need the channels:update scope')
  }
  // The webhook endpoint gets the host route's check here too, so a bad address is refused on save
  // rather than failing later at send time.
  if (body.channel === 'webhook' && body.config !== undefined) {
    const config = parseWith(webhookChannelBodySchema.partial(), body.config)
    const problem = config.endpointUrl
      ? webhookUrlProblem(config.endpointUrl, { allowPrivate: getWebhookPluginSettings().allowPrivateNetworks })
      : null
    if (problem) throw new HttpError(ErrorCode.VALIDATION_ERROR, `endpointUrl: ${problem}`)
  }
  const saved = await setAppChannelSetting(appId, body.channel, { enabled: body.enabled, config: body.config })
  return ok({ channel: body.channel, ...saved })
}

export async function channelStatusData(request: Request): Promise<Response> {
  await requireDashboardUser(request, 'Sign in to manage apps')
  return ok({
    channels: getNotificationChannels().map((channel) => channel.describe()),
  })
}

// The apps query for the keys page: dashboard-guarded and role-scoped, so an app
// admin never hits an instance-admin-only route.
export async function appsForDashboardData(request: Request): Promise<Response> {
  const userId = await requireDashboardUser(request, 'Sign in to manage apps')
  return ok({ apps: await listVisibleApps(userId) })
}
