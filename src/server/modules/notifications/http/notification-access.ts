import type { ApiKeyScope } from '@/lib/api-key-scopes'
import { prefixedBearer } from '@/server/http/credentials'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { requireServiceKey } from '@/server/modules/api-keys/infrastructure/api-key-repository'
import { type AppRecord, getAppByKey } from '@/server/modules/apps/infrastructure/app-repository'
import { verifyRecipientToken } from '@/server/modules/notifications/infrastructure/recipient-token-repository'

// Resolves the app named in the URL or fails with 404, so an unknown key never
// leaks into a query.
export async function requireApp(appKey: string): Promise<AppRecord> {
  const app = await getAppByKey(appKey)
  if (!app) throw new HttpError(ErrorCode.APP_NOT_FOUND)
  return app
}

// Browser credential for one recipient, supplied by the recipient's page. EventSource and
// WebSocket cannot set headers, so the `?token=` query form is accepted too.
export function extractRecipientToken(request: Request): string | null {
  const header = prefixedBearer(request.headers.get('authorization'), 'lrt_')
  if (header) return header
  const query = new URL(request.url).searchParams.get('token')?.trim()
  return query?.startsWith('lrt_') ? query : null
}

// Who is calling, before any body is read. A token pins its recipient and expires at
// `expiresAt`; an app key pins nothing, so the request must name the recipient.
export type InboxAuth =
  { via: 'token'; recipientKey: string; appKey: string; expiresAt: Date } | { via: 'key'; appKey: string }

export type InboxCaller = { recipientKey: string; via: 'token' | 'key'; appKey: string; expiresAt: Date | null }

export async function authenticateInbox(request: Request, app: AppRecord, scope: ApiKeyScope): Promise<InboxAuth> {
  const token = extractRecipientToken(request)
  if (token) {
    const verified = await verifyRecipientToken({ token, appId: app.id })
    if (!verified) throw new HttpError(ErrorCode.INVALID_RECIPIENT_TOKEN)
    return { via: 'token', recipientKey: verified.recipientKey, appKey: app.key, expiresAt: verified.expiresAt }
  }
  const key = await requireServiceKey(request, scope, app.key)
  return { via: 'key', appKey: key.appKey ?? app.key }
}

// Second step, once the body or query names a recipient: a token must match it, and an
// app key must have named one.
export function pinRecipient(auth: InboxAuth, recipientKey: string | null | undefined): InboxCaller {
  if (auth.via === 'token') {
    if (recipientKey && recipientKey !== auth.recipientKey) {
      throw new HttpError(ErrorCode.FORBIDDEN, 'Recipient token does not belong to this recipient')
    }
    return { recipientKey: auth.recipientKey, via: 'token', appKey: auth.appKey, expiresAt: auth.expiresAt }
  }
  if (!recipientKey) {
    throw new HttpError(ErrorCode.VALIDATION_ERROR, 'recipient: required when authenticating with an app key')
  }
  return { recipientKey, via: 'key', appKey: auth.appKey, expiresAt: null }
}

// The recipient is pinned by the token; an app key may act for any recipient it
// names, which is what server-side inbox rendering uses.
export async function requireInboxRecipient(
  request: Request,
  app: AppRecord,
  options: { scope: ApiKeyScope; recipientKey?: string | null },
): Promise<InboxCaller> {
  return pinRecipient(await authenticateInbox(request, app, options.scope), options.recipientKey)
}

// Preference writes: the recipient may change its own (its token), and an app key with
// recipients:update may change any recipient of its app. Returns which one acted.
export async function requireRecipientWriter(
  request: Request,
  app: AppRecord,
  recipientKey: string,
): Promise<'token' | 'key'> {
  const token = extractRecipientToken(request)
  if (token) {
    const verified = await verifyRecipientToken({ token, appId: app.id })
    if (!verified) throw new HttpError(ErrorCode.INVALID_RECIPIENT_TOKEN)
    if (verified.recipientKey !== recipientKey) {
      throw new HttpError(ErrorCode.FORBIDDEN, 'Recipient token does not belong to this recipient')
    }
    return 'token'
  }
  await requireServiceKey(request, 'recipients:update', app.key)
  return 'key'
}
