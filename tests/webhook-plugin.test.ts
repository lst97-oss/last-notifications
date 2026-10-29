import { describe, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'

import { HttpStatus } from '@lst97-oss/last-httprism'

import type { BusinessDb } from '@/server/db/business-sql'
import type { NotificationRecord } from '@/server/modules/notifications/domain/notification'
import type { AppChannelSettings } from '@/server/plugins/notification-channels'
import { createWebhookChannel, signWebhookBody } from '@/server/plugins/webhook/webhook.plugin'

const SECRET = 'webhook-test-secret-0123'
const NOW = new Date('2026-10-29T12:00:00.000Z')

const notification: NotificationRecord = {
  id: '6f1c9e2a-0000-4000-8000-000000000001',
  appId: 'app-1',
  recipientKey: 'user-1',
  type: 'comment.reply',
  title: 'New reply',
  body: 'Hello',
  data: { url: '/moderation/9', webhook: { event: 'comment.reply' } },
  priority: 0,
  dedupeKey: null,
  readAt: null,
  archivedAt: null,
  createdAt: '2026-10-29T11:59:00.000Z',
}

// The channel reads one row from recipient_channels; this fake answers that query only.
function fakeDb(address: string | null): BusinessDb {
  return {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => (address ? [{ address }] : []) }),
      }),
    }),
  } as unknown as BusinessDb
}

type Posted = { url: string; body: string; headers: Record<string, string> }

function harness(
  options: {
    address?: string | null
    status?: number
    secret?: string
    allowPrivate?: boolean
    perAppSecrets?: boolean
  } = {},
) {
  const posted: Posted[] = []
  const channel = createWebhookChannel({
    db: fakeDb(options.address === undefined ? 'https://hooks.example.com/notify' : options.address),
    config: {
      signingSecret: 'secret' in options ? options.secret : SECRET,
      perAppSecrets: options.perAppSecrets ?? false,
      timeoutMs: 10_000,
      allowPrivateNetworks: options.allowPrivate ?? false,
    },
    post: async (url, body, request) => {
      posted.push({ url, body, headers: request.headers })
      return { status: options.status ?? HttpStatus.OK.code }
    },
    now: () => NOW,
  })
  return { channel, posted }
}

const APP_SECRET = 'app-webhook-secret-0123456789'
const NO_APP_SETTINGS: AppChannelSettings = { config: {}, signingSecret: null, secretUnreadable: false }

const send = (channel: ReturnType<typeof createWebhookChannel>, settings: Partial<AppChannelSettings> = {}) =>
  channel.send({
    notification,
    app: { id: 'app-1', key: 'app-key', name: 'Demo' },
    recipientKey: 'user-1',
    settings: { ...NO_APP_SETTINGS, ...settings },
    signal: new AbortController().signal,
  })

describe('webhook channel', () => {
  test('posts the notification signed over timestamp and body', async () => {
    const { channel, posted } = harness()
    await send(channel)
    expect(posted).toHaveLength(1)
    const [request] = posted
    expect(request.url).toBe('https://hooks.example.com/notify')
    const payload = JSON.parse(request.body)
    expect(payload).toMatchObject({ id: notification.id, title: 'New reply', recipientKey: 'user-1' })
    expect(payload.app).toEqual({ key: 'app-key', name: 'Demo' })

    const timestamp = Math.floor(NOW.getTime() / 1000)
    const expected = createHmac('sha256', SECRET).update(`${timestamp}.${request.body}`).digest('hex')
    expect(request.headers['x-last-notifications-signature']).toBe(`t=${timestamp},v1=${expected}`)
    expect(request.headers['x-last-notifications-delivery']).toBe(notification.id)
    expect(request.headers['x-last-notifications-event']).toBe('comment.reply')
  })

  test('the signature helper matches the documented format', () => {
    expect(signWebhookBody(SECRET, 1700000000, '{"a":1}')).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/)
  })

  test('a 2xx answer completes the delivery', async () => {
    const { channel } = harness({ status: HttpStatus.ACCEPTED.code })
    await expect(send(channel)).resolves.toBeUndefined()
  })

  test.each([
    [HttpStatus.NOT_FOUND.code, false],
    [HttpStatus.GONE.code, false],
    [HttpStatus.MOVED_PERMANENTLY.code, false],
    [HttpStatus.REQUEST_TIMEOUT.code, true],
    [HttpStatus.TOO_MANY_REQUESTS.code, true],
    [HttpStatus.INTERNAL_SERVER_ERROR.code, true],
    [HttpStatus.SERVICE_UNAVAILABLE.code, true],
  ])('answer %p is retryable: %p', async (status, retryable) => {
    const { channel } = harness({ status })
    const failure = (await send(channel).catch((error: unknown) => error)) as { code: string; retryable: boolean }
    expect(failure.code).toBe(`WEBHOOK_HTTP_${status}`)
    expect(failure.retryable).toBe(retryable)
  })

  test('a recipient with no stored URL dead-letters at once', async () => {
    const { channel } = harness({ address: null })
    const failure = (await send(channel).catch((error: unknown) => error)) as { code: string; retryable: boolean }
    expect(failure).toMatchObject({ code: 'NO_RECIPIENT_ADDRESS', retryable: false })
  })

  test('an unsigned install refuses to send at all', async () => {
    const { channel, posted } = harness({ secret: undefined })
    const failure = (await send(channel).catch((error: unknown) => error)) as { code: string; retryable: boolean }
    expect(failure).toMatchObject({ code: 'WEBHOOK_NOT_CONFIGURED', retryable: false })
    expect(posted).toHaveLength(0)
  })

  test('a stored URL that policy now refuses is never posted to', async () => {
    const { channel, posted } = harness({ address: 'https://169.254.169.254/latest' })
    const failure = (await send(channel).catch((error: unknown) => error)) as { code: string; retryable: boolean }
    expect(failure).toMatchObject({ code: 'WEBHOOK_URL_BLOCKED', retryable: false })
    expect(posted).toHaveLength(0)
  })

  test('describe reports enabled only with a signing secret, and never the secret itself', () => {
    const configured = harness().channel.describe()
    expect(configured.enabled).toBe(true)
    expect(JSON.stringify(configured)).not.toContain(SECRET)
    expect(harness({ secret: undefined }).channel.describe().enabled).toBe(false)
  })

  test('per-app secrets alone make the channel usable, and the status says so', () => {
    const perAppOnly = harness({ secret: undefined, perAppSecrets: true }).channel.describe()
    expect(perAppOnly.enabled).toBe(true)
    expect(perAppOnly.detail).toContain('each app’s own secret')
  })

  test('with no recipient URL, the app endpoint receives the delivery', async () => {
    const { channel, posted } = harness({ address: null })
    await send(channel, { config: { endpointUrl: 'https://app.example.com/hooks' } })
    expect(posted.map((request) => request.url)).toEqual(['https://app.example.com/hooks'])
  })

  test('a recipient URL wins over the app endpoint, and only one POST goes out', async () => {
    const { channel, posted } = harness()
    await send(channel, { config: { endpointUrl: 'https://app.example.com/hooks' } })
    expect(posted.map((request) => request.url)).toEqual(['https://hooks.example.com/notify'])
  })

  test('the app secret signs the delivery in place of the server secret', async () => {
    const { channel, posted } = harness()
    await send(channel, { signingSecret: APP_SECRET })
    const [request] = posted
    const timestamp = Math.floor(NOW.getTime() / 1000)
    const expected = createHmac('sha256', APP_SECRET).update(`${timestamp}.${request.body}`).digest('hex')
    expect(request.headers['x-last-notifications-signature']).toBe(`t=${timestamp},v1=${expected}`)
  })

  test('an app secret signs even when the server has none', async () => {
    const { channel, posted } = harness({ secret: undefined })
    await send(channel, { signingSecret: APP_SECRET })
    expect(posted).toHaveLength(1)
  })

  test('an unreadable app secret refuses to send and never falls back to the server secret', async () => {
    const { channel, posted } = harness()
    const failure = (await send(channel, { secretUnreadable: true }).catch((error: unknown) => error)) as {
      code: string
      retryable: boolean
    }
    expect(failure).toMatchObject({ code: 'APP_SIGNING_SECRET_UNREADABLE', retryable: false })
    expect(posted).toHaveLength(0)
  })

  test('an app endpoint goes through the same URL policy as a recipient URL', async () => {
    const { channel, posted } = harness({ address: null })
    const failure = (await send(channel, { config: { endpointUrl: 'https://169.254.169.254/latest' } }).catch(
      (error: unknown) => error,
    )) as { code: string; retryable: boolean }
    expect(failure).toMatchObject({ code: 'WEBHOOK_URL_BLOCKED', retryable: false })
    expect(posted).toHaveLength(0)
  })
})
