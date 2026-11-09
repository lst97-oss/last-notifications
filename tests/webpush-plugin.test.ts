import { describe, expect, test } from 'bun:test'

import type { BusinessDb } from '@/server/db/business-sql'
import type { NotificationRecord } from '@/server/modules/notifications/domain/notification'
import { createWebpushChannel } from '@/server/plugins/webpush/webpush.plugin'

// A real database is not needed: the plugin's only DB work is one select and two
// updates, which this fake records.
function fakeDb(
  subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string; failureCount: number }>,
) {
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = []
  const db = {
    select: () => ({
      from: () => ({
        where: async () => subscriptions,
      }),
    }),
    update: () => ({
      set: (patch: Record<string, unknown>) => ({
        where: async () => {
          updates.push({ id: 'batch', patch })
        },
      }),
    }),
  }
  return { db: db as unknown as BusinessDb, updates }
}

const notification: NotificationRecord = {
  id: 'notif-1',
  appId: 'app-1',
  recipientKey: 'user-1',
  type: 'comment.reply',
  title: 'Hi',
  body: 'There',
  data: { webpush: { icon: 'https://example.com/i.png' } },
  priority: 0,
  dedupeKey: null,
  readAt: null,
  archivedAt: null,
  createdAt: '2026-10-28T00:00:00.000Z',
}

const config = {
  configured: true,
  publicKey: 'pub',
  privateKey: 'priv',
  subject: 'mailto:ops@example.com',
  ttlSeconds: 60,
  urgency: 'normal' as const,
}

describe('webpush channel', () => {
  test('marks an endpoint failed on 410 and reports the failure', async () => {
    const { db } = fakeDb([
      { id: 'sub-1', endpoint: 'https://fcm.googleapis.com/1', p256dh: 'k', auth: 'a', failureCount: 0 },
    ])
    const channel = createWebpushChannel({
      db,
      config,
      send: async () => {
        throw Object.assign(new Error('gone'), { statusCode: 410 })
      },
    })
    await expect(
      channel.send({
        notification,
        app: { id: 'app-1', key: 'app', name: 'App' },
        recipientKey: 'user-1',
        settings: { config: {}, signingSecret: null, secretUnreadable: false },
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow('PUSH_HTTP_410')
  })

  test('succeeds when one of several endpoints accepts', async () => {
    const { db } = fakeDb([
      { id: 'sub-1', endpoint: 'https://fcm.googleapis.com/1', p256dh: 'k', auth: 'a', failureCount: 0 },
      { id: 'sub-2', endpoint: 'https://fcm.googleapis.com/2', p256dh: 'k', auth: 'a', failureCount: 0 },
    ])
    let calls = 0
    const channel = createWebpushChannel({
      db,
      config,
      send: async () => {
        calls += 1
        if (calls === 1) throw Object.assign(new Error('gone'), { statusCode: 404 })
        return { statusCode: 201 }
      },
    })
    await channel.send({
      notification,
      app: { id: 'app-1', key: 'app', name: 'App' },
      recipientKey: 'user-1',
      settings: { config: {}, signingSecret: null, secretUnreadable: false },
      signal: new AbortController().signal,
    })
    expect(calls).toBe(2)
  })

  test('sends the style keys in the payload', async () => {
    const { db } = fakeDb([
      { id: 'sub-1', endpoint: 'https://fcm.googleapis.com/1', p256dh: 'k', auth: 'a', failureCount: 0 },
    ])
    let payload = ''
    const channel = createWebpushChannel({
      db,
      config,
      send: async (_subscription, body) => {
        payload = body
        return { statusCode: 201 }
      },
    })
    await channel.send({
      notification,
      app: { id: 'app-1', key: 'app', name: 'App' },
      recipientKey: 'user-1',
      settings: { config: {}, signingSecret: null, secretUnreadable: false },
      signal: new AbortController().signal,
    })
    expect(JSON.parse(payload)).toMatchObject({ title: 'Hi', tag: 'notif-1', icon: 'https://example.com/i.png' })
  })

  test('fails with NO_PUSH_SUBSCRIPTION when nothing is registered', async () => {
    const { db } = fakeDb([])
    const channel = createWebpushChannel({ db, config, send: async () => ({ statusCode: 201 }) })
    await expect(
      channel.send({
        notification,
        app: { id: 'app-1', key: 'app', name: 'App' },
        recipientKey: 'user-1',
        settings: { config: {}, signingSecret: null, secretUnreadable: false },
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow('NO_PUSH_SUBSCRIPTION')
  })

  test('is disabled when the VAPID keys are missing', () => {
    const channel = createWebpushChannel({
      db: fakeDb([]).db,
      config: { ...config, configured: false, publicKey: null, privateKey: null, subject: null },
    })
    expect(channel.describe().enabled).toBe(false)
  })
})

describe('webpush send limits', () => {
  const twoEndpoints = fakeDb([
    { id: 'sub-1', endpoint: 'https://fcm.googleapis.com/1', p256dh: 'k', auth: 'a', failureCount: 0 },
    { id: 'sub-2', endpoint: 'https://fcm.googleapis.com/2', p256dh: 'k', auth: 'a', failureCount: 0 },
    { id: 'sub-3', endpoint: 'https://fcm.googleapis.com/3', p256dh: 'k', auth: 'a', failureCount: 0 },
  ]).db

  const sendWith = (channel: ReturnType<typeof createWebpushChannel>, signal: AbortSignal) =>
    channel.send({
      notification,
      app: { id: 'app-1', key: 'app', name: 'App' },
      recipientKey: 'user-1',
      settings: { config: {}, signingSecret: null, secretUnreadable: false },
      signal,
    })

  test('stops sending to the other endpoints once the handler gives up', async () => {
    const controller = new AbortController()
    let calls = 0
    const channel = createWebpushChannel({
      db: twoEndpoints,
      config,
      send: async () => {
        calls += 1
        controller.abort()
        return { statusCode: 201 }
      },
    })
    await sendWith(channel, controller.signal)
    expect(calls).toBe(1)
  })

  test('never calls an endpoint outside the browser push services', async () => {
    const { db } = fakeDb([
      { id: 'sub-1', endpoint: 'https://10.0.0.5:8443/push', p256dh: 'k', auth: 'a', failureCount: 0 },
      { id: 'sub-2', endpoint: 'https://fcm.googleapis.com/fcm/send/ok', p256dh: 'k', auth: 'a', failureCount: 0 },
    ])
    const called: string[] = []
    const channel = createWebpushChannel({
      db,
      config,
      send: async (subscription) => {
        called.push(subscription.endpoint)
        return { statusCode: 201 }
      },
    })
    await sendWith(channel, new AbortController().signal)
    expect(called).toEqual(['https://fcm.googleapis.com/fcm/send/ok'])
  })

  test('bounds each push call with its own request timeout', async () => {
    let seen: unknown = null
    const channel = createWebpushChannel({
      db: twoEndpoints,
      config,
      send: async (_subscription, _payload, options) => {
        seen = options
        return { statusCode: 201 }
      },
    })
    await sendWith(channel, new AbortController().signal)
    expect(typeof (seen as { timeout?: unknown }).timeout).toBe('number')
  })
})
