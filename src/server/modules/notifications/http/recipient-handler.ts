import { ErrorCode, HttpError } from '@/server/http/errors'
import { ok } from '@/server/http/response'
import { parseSearchParams, parseWith } from '@/server/http/validation'
import { requireServiceKey } from '@/server/modules/api-keys/infrastructure/api-key-repository'
import { requireApp } from '@/server/modules/notifications/http/notification-access'
import {
  appKeyParamSchema,
  contactClearQuerySchema,
  recipientKeyParamSchema,
  recipientListQuerySchema,
} from '@/server/modules/notifications/http/notification-schemas'
import {
  clearRecipientContact,
  getRecipientSummary,
  listRecipientKeys,
} from '@/server/modules/notifications/infrastructure/recipient-repository'

// Recipient management is for the publishing host, so every route here is key-only. A recipient's
// own token cannot read or clear another recipient's state.

function encodeRecipientCursor(recipientKey: string): string {
  return Buffer.from(recipientKey, 'utf8').toString('base64url')
}

function decodeRecipientCursor(cursor: string): string {
  const recipientKey = Buffer.from(cursor, 'base64url').toString('utf8')
  if (!recipientKey) throw new HttpError(ErrorCode.VALIDATION_ERROR, 'cursor: not a valid cursor')
  return parseWith(recipientKeyParamSchema, recipientKey)
}

export async function getRecipientData(
  request: Request,
  params: { appKey: string; recipientKey: string },
): Promise<Response> {
  const app = await requireApp(parseWith(appKeyParamSchema, params.appKey))
  await requireServiceKey(request, 'recipients:read', app.key)
  const recipientKey = parseWith(recipientKeyParamSchema, params.recipientKey)
  return ok(await getRecipientSummary({ appId: app.id, recipientKey }))
}

export async function listRecipientsData(request: Request, params: { appKey: string }): Promise<Response> {
  const app = await requireApp(parseWith(appKeyParamSchema, params.appKey))
  await requireServiceKey(request, 'recipients:read', app.key)
  const query = parseSearchParams(request.url, recipientListQuerySchema)
  const page = await listRecipientKeys({
    appId: app.id,
    limit: query.limit,
    after: query.cursor ? decodeRecipientCursor(query.cursor) : null,
  })
  return ok({
    recipients: page.recipientKeys,
    next: page.next ? encodeRecipientCursor(page.next) : null,
  })
}

// Idempotent: clearing a channel that is already empty reports `cleared: false` rather than failing.
export async function clearContactData(
  request: Request,
  params: { appKey: string; recipientKey: string },
): Promise<Response> {
  const app = await requireApp(parseWith(appKeyParamSchema, params.appKey))
  await requireServiceKey(request, 'recipients:delete', app.key)
  const recipientKey = parseWith(recipientKeyParamSchema, params.recipientKey)
  const query = parseSearchParams(request.url, contactClearQuerySchema)
  const cleared = await clearRecipientContact({ appId: app.id, recipientKey, channel: query.channel })
  return ok({ channel: query.channel, cleared })
}
