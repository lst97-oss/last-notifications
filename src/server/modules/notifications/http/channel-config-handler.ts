import { ErrorCode, HttpError } from '@/server/http/errors'
import { ok } from '@/server/http/response'
import { parseJsonBody, parseWith } from '@/server/http/validation'
import { requireServiceKey } from '@/server/modules/api-keys/infrastructure/api-key-repository'
import {
  getAppChannelSettings,
  setAppChannelSecret,
  setAppChannelSecretIfAbsent,
  setAppChannelSetting,
} from '@/server/modules/apps/infrastructure/app-repository'
import { webhookUrlProblem } from '@/server/modules/notifications/domain/webhook-url'
import { requireApp } from '@/server/modules/notifications/http/notification-access'
import { appKeyParamSchema, webhookChannelBodySchema } from '@/server/modules/notifications/http/notification-schemas'
import { getWebhookPluginSettings } from '@/server/plugins/webhook/webhook.config'
import { newSigningSecret, SecretBoxError, sealSecret } from '@/server/security/secret-box'

// Host-facing delivery settings. These routes are server-to-server: the bound key decides the app,
// so no browser Origin check applies (the dashboard keeps its own guard on the admin routes).

// Issues a signing secret and seals it before anything is written, so a missing
// SECRET_ENCRYPTION_KEY fails the call without leaving a half-saved configuration.
function issueSealedSecret(): { secret: string; sealed: string } {
  const secret = newSigningSecret()
  try {
    return { secret, sealed: sealSecret(secret) }
  } catch (error) {
    if (error instanceof SecretBoxError) throw new HttpError(ErrorCode.SECRET_ENCRYPTION_UNAVAILABLE)
    throw error
  }
}

// Never returns the secret: a host learns only whether one is set.
export async function getChannelsData(request: Request, params: { appKey: string }): Promise<Response> {
  const app = await requireApp(parseWith(appKeyParamSchema, params.appKey))
  await requireServiceKey(request, 'channels:read', app.key)
  const webhook = (await getAppChannelSettings(app.id)).webhook
  const endpointUrl = webhook?.config.endpointUrl
  return ok({
    channels: [
      {
        channel: 'webhook',
        enabled: webhook?.enabled ?? true,
        endpointUrl: typeof endpointUrl === 'string' ? endpointUrl : null,
        secretConfigured: webhook?.secretConfigured ?? false,
      },
    ],
  })
}

// Idempotent: safe to repeat on every boot. The secret is returned only on the call that issues it.
export async function putWebhookChannelData(request: Request, params: { appKey: string }): Promise<Response> {
  const app = await requireApp(parseWith(appKeyParamSchema, params.appKey))
  await requireServiceKey(request, 'channels:update', app.key)
  const body = await parseJsonBody(request, webhookChannelBodySchema)
  if (body.endpointUrl !== null) {
    const problem = webhookUrlProblem(body.endpointUrl, {
      allowPrivate: getWebhookPluginSettings().allowPrivateNetworks,
    })
    if (problem) throw new HttpError(ErrorCode.VALIDATION_ERROR, `endpointUrl: ${problem}`)
  }
  const current = (await getAppChannelSettings(app.id)).webhook
  const issued = current?.secretConfigured ? null : issueSealedSecret()
  await setAppChannelSetting(app.id, 'webhook', { config: { endpointUrl: body.endpointUrl } })
  // Two first registrations can race. Only the call whose write lands gets its secret back; the other
  // sees the channel configured and no secret, because the stored one belongs to the winner.
  const stored = issued ? await setAppChannelSecretIfAbsent(app.id, 'webhook', issued.sealed) : false
  return ok({
    channel: 'webhook',
    endpointUrl: body.endpointUrl,
    secretConfigured: true,
    ...(issued && stored ? { secret: issued.secret } : {}),
  })
}

// Explicit rotation: the previous secret stops signing at once, so the host must redeploy its receiver.
export async function rotateWebhookSecretData(request: Request, params: { appKey: string }): Promise<Response> {
  const app = await requireApp(parseWith(appKeyParamSchema, params.appKey))
  await requireServiceKey(request, 'channels:update', app.key)
  const issued = issueSealedSecret()
  await setAppChannelSecret(app.id, 'webhook', issued.sealed)
  return ok({ channel: 'webhook', secretConfigured: true, secret: issued.secret })
}
