import { HttpStatus } from '@lst97-oss/last-httprism'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { ok } from '@/server/http/response'
import { parseJsonBody, parseSearchParams, parseWith } from '@/server/http/validation'
import { requireServiceKey } from '@/server/modules/api-keys/infrastructure/api-key-repository'
import { publishNotification } from '@/server/modules/notifications/application/publish-notification'
import { encodeCursor } from '@/server/modules/notifications/domain/notification'
import { isPushServiceEndpoint } from '@/server/modules/notifications/domain/push-endpoint'
import { verifyUnsubscribeToken } from '@/server/modules/notifications/domain/unsubscribe-token'
import { webhookUrlProblem } from '@/server/modules/notifications/domain/webhook-url'
import { toInboxItem } from '@/server/modules/notifications/http/inbox-item'
import {
  authenticateInbox,
  extractRecipientToken,
  pinRecipient,
  requireApp,
  requireInboxRecipient,
  requireRecipientWriter,
} from '@/server/modules/notifications/http/notification-access'
import {
  appKeyParamSchema,
  archiveBodySchema,
  contactBodySchema,
  inboxQuerySchema,
  inboxReadBodySchema,
  notificationIdParamSchema,
  PUBLISH_BODY_MAX_BYTES,
  preferencesBodySchema,
  publishBodySchema,
  pushSubscriptionBodySchema,
  pushUnsubscribeBodySchema,
  recipientKeyParamSchema,
  recipientQuerySchema,
  restoreBodySchema,
  unsubscribeBodySchema,
} from '@/server/modules/notifications/http/notification-schemas'
import { unsubscribeConfirmPage, unsubscribedPage } from '@/server/modules/notifications/http/unsubscribe-page'
import {
  archiveNotifications,
  countInbox,
  deleteNotification,
  listInboxItems,
  markNotificationsRead,
  restoreNotifications,
  setChannelPreference,
  setRecipientChannelAddress,
} from '@/server/modules/notifications/infrastructure/notification-repository'
import {
  deletePushSubscription,
  upsertPushSubscription,
} from '@/server/modules/notifications/infrastructure/push-subscription-repository'
import { mintRecipientToken } from '@/server/modules/notifications/infrastructure/recipient-token-repository'
import { getWebhookPluginSettings } from '@/server/plugins/webhook/webhook.config'
import { getWebpushConfig } from '@/server/plugins/webpush/webpush.config'

export async function publishNotificationData(request: Request, params: { appKey: string }): Promise<Response> {
  const appKey = parseWith(appKeyParamSchema, params.appKey)
  const app = await requireApp(appKey)
  await requireServiceKey(request, 'notifications:create', app.key)
  const body = await parseJsonBody(request, publishBodySchema, PUBLISH_BODY_MAX_BYTES)
  const result = await publishNotification({
    app,
    recipientKey: body.recipientKey,
    type: body.type,
    title: body.title,
    body: body.body,
    data: body.data,
    priority: body.priority,
    channels: body.channels,
    dedupeKey: body.dedupeKey,
    emailOverride: body.email,
  })
  return ok(result, { status: HttpStatus.ACCEPTED.code })
}

export async function listInboxData(request: Request, params: { appKey: string }): Promise<Response> {
  const app = await requireApp(parseWith(appKeyParamSchema, params.appKey))
  const query = parseSearchParams(request.url, inboxQuerySchema)
  const caller = await requireInboxRecipient(request, app, {
    scope: 'notifications:read',
    recipientKey: query.recipient,
  })
  const view = query.view ?? 'active'
  const [page, counts] = await Promise.all([
    listInboxItems({
      appId: app.id,
      recipientKey: caller.recipientKey,
      since: query.since,
      before: query.before,
      limit: query.limit,
      order: query.order,
      view,
    }),
    countInbox({ appId: app.id, recipientKey: caller.recipientKey }),
  ])
  // A newest-first caller resumes the live stream from the newest row of the first inbox page.
  const newest = query.order === 'desc' && !query.before && view === 'active' ? page.items[0] : undefined
  return ok({
    ...page,
    items: page.items.map(toInboxItem),
    total: counts.total,
    unread: counts.unread,
    latest: newest ? encodeCursor({ t: newest.createdAt, i: newest.id }) : null,
  })
}

export async function archiveInboxData(request: Request, params: { appKey: string }): Promise<Response> {
  const app = await requireApp(parseWith(appKeyParamSchema, params.appKey))
  const auth = await authenticateInbox(request, app, 'notifications:update')
  const body = await parseJsonBody(request, archiveBodySchema)
  const caller = pinRecipient(auth, body.recipientKey)
  const archived = await archiveNotifications({
    appId: app.id,
    recipientKey: caller.recipientKey,
    ids: body.ids,
    read: body.read,
  })
  return ok({ archived })
}

export async function restoreInboxData(request: Request, params: { appKey: string }): Promise<Response> {
  const app = await requireApp(parseWith(appKeyParamSchema, params.appKey))
  const auth = await authenticateInbox(request, app, 'notifications:update')
  const body = await parseJsonBody(request, restoreBodySchema)
  const caller = pinRecipient(auth, body.recipientKey)
  const restored = await restoreNotifications({ appId: app.id, recipientKey: caller.recipientKey, ids: body.ids })
  return ok({ restored })
}

export async function markInboxReadData(request: Request, params: { appKey: string }): Promise<Response> {
  const app = await requireApp(parseWith(appKeyParamSchema, params.appKey))
  const auth = await authenticateInbox(request, app, 'notifications:update')
  const body = await parseJsonBody(request, inboxReadBodySchema)
  const caller = pinRecipient(auth, body.recipientKey)
  const updated = await markNotificationsRead({
    appId: app.id,
    recipientKey: caller.recipientKey,
    ids: body.ids,
    all: body.all,
  })
  return ok({ updated })
}

export async function deleteNotificationData(
  request: Request,
  params: { appKey: string; id: string },
): Promise<Response> {
  const app = await requireApp(parseWith(appKeyParamSchema, params.appKey))
  const id = parseWith(notificationIdParamSchema, params.id)
  // A key names the recipient in the query; a recipient token is pinned to its own rows.
  const query = parseSearchParams(request.url, recipientQuerySchema)
  const caller = await requireInboxRecipient(request, app, {
    scope: 'notifications:delete',
    recipientKey: query.recipient,
  })
  const removed = await deleteNotification({ appId: app.id, recipientKey: caller.recipientKey, id })
  if (!removed) throw new HttpError(ErrorCode.NOTIFICATION_NOT_FOUND)
  return ok({ deleted: true })
}

export async function mintRecipientTokenData(
  request: Request,
  params: { appKey: string; recipientKey: string },
): Promise<Response> {
  const app = await requireApp(parseWith(appKeyParamSchema, params.appKey))
  const recipientKey = parseWith(recipientKeyParamSchema, params.recipientKey)
  await requireServiceKey(request, 'tokens:create', app.key)
  const minted = await mintRecipientToken({ appId: app.id, recipientKey })
  return ok({ token: minted.token, expiresAt: minted.expiresAt.toISOString() })
}

export async function setContactData(
  request: Request,
  params: { appKey: string; recipientKey: string },
): Promise<Response> {
  const app = await requireApp(parseWith(appKeyParamSchema, params.appKey))
  const recipientKey = parseWith(recipientKeyParamSchema, params.recipientKey)
  // A contact address decides where mail or webhooks go, so only the publisher (an app key) may set one.
  // A browser token that could set it could redirect a recipient's mail for good, long after the token expires.
  if (extractRecipientToken(request)) {
    throw new HttpError(ErrorCode.FORBIDDEN, 'A recipient token cannot change a contact address')
  }
  await requireServiceKey(request, 'recipients:update', app.key)
  const body = await parseJsonBody(request, contactBodySchema)
  if (body.channel === 'webhook') {
    const problem = webhookUrlProblem(body.address, {
      allowPrivate: getWebhookPluginSettings().allowPrivateNetworks,
    })
    if (problem) throw new HttpError(ErrorCode.VALIDATION_ERROR, `address: ${problem}`)
  }
  await setRecipientChannelAddress({ appId: app.id, recipientKey, channel: body.channel, address: body.address })
  return ok({ channel: body.channel, address: body.address })
}

export async function setPreferencesData(
  request: Request,
  params: { appKey: string; recipientKey: string },
): Promise<Response> {
  const app = await requireApp(parseWith(appKeyParamSchema, params.appKey))
  const recipientKey = parseWith(recipientKeyParamSchema, params.recipientKey)
  await requireRecipientWriter(request, app, recipientKey)
  const body = await parseJsonBody(request, preferencesBodySchema)
  await setChannelPreference({ appId: app.id, recipientKey, channel: body.channel, enabled: body.enabled })
  return ok({ channel: body.channel, enabled: body.enabled })
}

export async function subscribePushData(request: Request, params: { appKey: string }): Promise<Response> {
  const app = await requireApp(parseWith(appKeyParamSchema, params.appKey))
  const auth = await authenticateInbox(request, app, 'recipients:update')
  const body = await parseJsonBody(request, pushSubscriptionBodySchema)
  // The worker calls this endpoint, so only a browser push service may be named.
  if (!isPushServiceEndpoint(body.endpoint)) {
    throw new HttpError(ErrorCode.VALIDATION_ERROR, 'endpoint: must be an https address of a browser push service')
  }
  const caller = pinRecipient(auth, body.recipientKey)
  await upsertPushSubscription({
    appId: app.id,
    recipientKey: caller.recipientKey,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    userAgent: request.headers.get('user-agent'),
  })
  return ok({ subscribed: true })
}

export async function unsubscribePushData(request: Request, params: { appKey: string }): Promise<Response> {
  const app = await requireApp(parseWith(appKeyParamSchema, params.appKey))
  const auth = await authenticateInbox(request, app, 'recipients:delete')
  const body = await parseJsonBody(request, pushUnsubscribeBodySchema)
  const caller = pinRecipient(auth, body.recipientKey)
  const removed = await deletePushSubscription({
    appId: app.id,
    recipientKey: caller.recipientKey,
    endpoint: body.endpoint,
  })
  return ok({ removed })
}

// The VAPID public key is public by design; a recipient still has to hold a valid
// credential to read it, so the endpoint cannot be probed anonymously.
export async function webpushPublicKeyData(request: Request, params: { appKey: string }): Promise<Response> {
  const app = await requireApp(parseWith(appKeyParamSchema, params.appKey))
  await requireInboxRecipient(request, app, { scope: 'notifications:read' })
  const config = getWebpushConfig()
  if (!config.publicKey) throw new HttpError(ErrorCode.WEBPUSH_NOT_CONFIGURED)
  return ok({ publicKey: config.publicKey })
}

// One-click (RFC 8058) and programmatic unsubscribe. The token is the proof, so
// this route takes no session and no API key: the mail client posts the URL from
// the List-Unsubscribe header with an empty body.
// The signed link carries its proof in the query string. Without a query token, the body must carry it.
async function readUnsubscribeLink(request: Request) {
  const url = new URL(request.url)
  const fromQuery = {
    appKey: url.searchParams.get('appKey'),
    recipientKey: url.searchParams.get('recipientKey'),
    email: url.searchParams.get('email'),
    token: url.searchParams.get('token'),
  }
  const body: { appKey: string; recipientKey: string; email: string; token: string } = fromQuery.token
    ? (fromQuery as { appKey: string; recipientKey: string; email: string; token: string })
    : await parseJsonBody(request, unsubscribeBodySchema)
  const app = await requireApp(parseWith(appKeyParamSchema, body.appKey))
  const recipientKey = parseWith(recipientKeyParamSchema, body.recipientKey)
  if (!verifyUnsubscribeToken({ appId: app.id, recipientKey, email: body.email, token: body.token })) {
    throw new HttpError(ErrorCode.FORBIDDEN, 'Unsubscribe token is invalid')
  }
  return { app, recipientKey, email: body.email }
}

// GET only shows what the link would do. It changes nothing, because mail scanners and link
// previews fetch GET URLs, and a GET must never turn email off.
export async function unsubscribeConfirmData(request: Request): Promise<Response> {
  const { app, email } = await readUnsubscribeLink(request)
  return unsubscribeConfirmPage({ appName: app.name, email })
}

// POST turns email off. A one-click mail client (RFC 8058) reads the JSON; a browser form submit
// gets the page instead.
export async function unsubscribeData(request: Request): Promise<Response> {
  const { app, recipientKey } = await readUnsubscribeLink(request)
  await setChannelPreference({ appId: app.id, recipientKey, channel: 'email', enabled: false })
  if (request.headers.get('accept')?.includes('text/html')) return unsubscribedPage({ appName: app.name })
  return ok({ unsubscribed: true })
}
