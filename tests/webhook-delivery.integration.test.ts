import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'

import { and, eq } from 'drizzle-orm'

import { closeBusinessSql, getBusinessDb } from '@/server/db/business-sql'
import { notificationDeliveries } from '@/server/db/schema'
import { createApp, deleteApp } from '@/server/modules/apps/infrastructure/app-repository'
import { publishNotification } from '@/server/modules/notifications/application/publish-notification'
import { setRecipientChannelAddress } from '@/server/modules/notifications/infrastructure/notification-repository'
import { deliverPendingChannelDeliveries } from '@/server/plugins/channel-delivery'
import type { NotificationChannel } from '@/server/plugins/notification-channels'
import { postWebhook } from '@/server/plugins/webhook/safe-http'
import { createWebhookChannel } from '@/server/plugins/webhook/webhook.plugin'

// Live run through the real delivery worker: publish, claim, sign, POST to a local receiver, record the
// outcome. The channel is built with explicit config, so no environment variable decides the policy.
const SECRET = 'webhook-integration-secret-0123'
const APP_NAME = 'integration-webhook'
const ORIGIN = 'https://webhook-integration.test'

const received: { headers: Headers; body: string }[] = []
const receiver = Bun.serve({
  port: 0,
  hostname: '127.0.0.1',
  async fetch(request) {
    received.push({ headers: request.headers, body: await request.text() })
    return new Response('ok')
  },
})

let appKey = ''
let appId = ''

beforeAll(async () => {
  const app = await createApp(null, { name: APP_NAME, origin: ORIGIN })
  appKey = app.key
  appId = app.id
})

afterAll(async () => {
  if (appKey) await deleteApp(appKey)
  receiver.stop(true)
  await closeBusinessSql()
})

const app = () => ({ id: appId, key: appKey, name: APP_NAME })

// Email and webpush are not under test; a passing stub drains any rows other suites left pending.
const passing = (channel: 'email' | 'webpush'): NotificationChannel => ({
  id: channel,
  apiVersion: 1,
  channel,
  describe: () => ({ id: channel, apiVersion: 1, enabled: true, detail: 'stub', facts: [], channels: [channel] }),
  send: async () => {},
})

async function deliverWebhook(channel: NotificationChannel) {
  await deliverPendingChannelDeliveries(getBusinessDb(), new Date(Date.now() + 1_000), [
    channel,
    passing('email'),
    passing('webpush'),
  ])
}

async function webhookDelivery(notificationId: string) {
  const [row] = await getBusinessDb()
    .select()
    .from(notificationDeliveries)
    .where(
      and(eq(notificationDeliveries.notificationId, notificationId), eq(notificationDeliveries.channel, 'webhook')),
    )
  return row
}

describe('webhook delivery through the worker', () => {
  test('posts a signed body to the stored URL and marks it delivered', async () => {
    const recipientKey = 'hook-receiver'
    await setRecipientChannelAddress(
      { appId, recipientKey, channel: 'webhook', address: `http://localhost:${receiver.port}/hook` },
      getBusinessDb(),
    )
    const published = await publishNotification({
      app: app(),
      recipientKey,
      type: 'comment.reply',
      title: 'Signed reply',
      body: 'hello',
      data: { webhook: { event: 'comment.reply' } },
      priority: 0,
      channels: ['webhook'],
    })
    const permissive = createWebhookChannel({
      config: { signingSecret: SECRET, perAppSecrets: false, timeoutMs: 5_000, allowPrivateNetworks: true },
      post: postWebhook,
    })
    await deliverWebhook(permissive)

    expect((await webhookDelivery(published.id))?.status).toBe('delivered')
    const delivered = received.find((request) => request.headers.get('x-last-notifications-delivery') === published.id)
    expect(delivered).toBeDefined()
    expect(JSON.parse(delivered?.body ?? '{}')).toMatchObject({ id: published.id, title: 'Signed reply', recipientKey })
    expect(delivered?.headers.get('x-last-notifications-event')).toBe('comment.reply')

    const signature = delivered?.headers.get('x-last-notifications-signature') ?? ''
    const [, timestamp, digest] = signature.match(/^t=(\d+),v1=([0-9a-f]{64})$/) ?? []
    const expected = createHmac('sha256', SECRET)
      .update(`${timestamp}.${delivered?.body ?? ''}`)
      .digest('hex')
    expect(digest).toBe(expected)
  })

  test('a stored address the strict policy refuses dead-letters on the first attempt', async () => {
    const recipientKey = 'hook-metadata'
    await setRecipientChannelAddress(
      { appId, recipientKey, channel: 'webhook', address: 'https://169.254.169.254/latest/meta-data' },
      getBusinessDb(),
    )
    const published = await publishNotification({
      app: app(),
      recipientKey,
      type: 't',
      title: 'Should never leave',
      body: '',
      data: {},
      priority: 0,
      channels: ['webhook'],
    })
    const strict = createWebhookChannel({
      config: { signingSecret: SECRET, perAppSecrets: false, timeoutMs: 5_000, allowPrivateNetworks: false },
      post: postWebhook,
    })
    await deliverWebhook(strict)

    const delivery = await webhookDelivery(published.id)
    expect(delivery?.status).toBe('dead_letter')
    expect(delivery?.attempts).toBe(1)
    expect(delivery?.lastError).toBe('WEBHOOK_URL_BLOCKED')
    expect(received.some((request) => request.headers.get('x-last-notifications-delivery') === published.id)).toBe(
      false,
    )
  })
})
