import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { and, eq, inArray } from 'drizzle-orm'

import { HttpStatus } from '@lst97-oss/last-httprism'

import { closeBusinessSql, getBusinessDb } from '@/server/db/business-sql'
import { notificationDeliveries, notifications } from '@/server/db/schema'
import { ErrorCode } from '@/server/http/errors'
import { withContext } from '@/server/http/with-context'
import { publishNotification } from '@/server/modules/notifications/application/publish-notification'
import { createApp, deleteApp } from '@/server/modules/apps/infrastructure/app-repository'
import { encodeCursor } from '@/server/modules/notifications/domain/notification'
import { createUnsubscribeToken } from '@/server/modules/notifications/domain/unsubscribe-token'
import {
  listInboxData,
  unsubscribeConfirmData,
  unsubscribeData,
} from '@/server/modules/notifications/http/notification-handler'
import { streamInboxData } from '@/server/modules/notifications/http/stream-handler'
import {
  archiveNotifications,
  countInbox,
  getChannelPreferences,
  getNotificationById,
  listInboxItems,
  markNotificationsRead,
  purgeArchivedNotifications,
  restoreNotifications,
  setChannelPreference,
} from '@/server/modules/notifications/infrastructure/notification-repository'
import {
  mintRecipientToken,
  verifyRecipientToken,
} from '@/server/modules/notifications/infrastructure/recipient-token-repository'
import { getAppStats, getFleetStats } from '@/server/modules/stats/infrastructure/stats-queries'
import { inboxPageSchema, notificationSchema, publishResultSchema } from '@/server/openapi/response-schemas'
import {
  deliverPendingChannelDeliveries,
  purgeDeliveredNotifications,
  requeueDeadLetter,
} from '@/server/plugins/channel-delivery'
import { ChannelError, type NotificationChannel } from '@/server/plugins/notification-channels'

// Live integration suite against BUSINESS_DATABASE_URL (the demo container).
// Creates its own app and deletes it in afterAll; the app cascade removes every
// notification, delivery, and token the test made.
const APP_NAME = 'integration-notifications'
const ORIGIN = 'https://notifications-integration.test'
let appKey = ''
let appId = ''

beforeAll(async () => {
  const app = await createApp(null, { name: APP_NAME, origin: ORIGIN })
  appKey = app.key
  appId = app.id
})

afterAll(async () => {
  if (appKey) await deleteApp(appKey)
  await closeBusinessSql()
})

const app = () => ({ id: appId, key: appKey, name: APP_NAME })

describe('publishNotification', () => {
  test('writes the inbox row plus one delivery per async channel', async () => {
    const published = await publishNotification({
      app: app(),
      recipientKey: 'user-1',
      type: 'comment.reply',
      title: 'New reply',
      body: 'Hello',
      data: { commentId: 'c-1' },
      priority: 1,
      channels: ['inapp', 'email'],
      emailOverride: 'someone@example.com',
    })
    expect(published.duplicate).toBe(false)

    const stored = await getNotificationById(published.id)
    expect(stored?.title).toBe('New reply')
    expect(stored?.data).toEqual({ commentId: 'c-1' })

    const deliveries = await getBusinessDb()
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.notificationId, published.id))
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]?.channel).toBe('email')
    expect(deliveries[0]?.addressOverride).toBe('someone@example.com')
  })

  test('a repeated dedupeKey returns the same id and adds no delivery', async () => {
    const first = await publishNotification({
      app: app(),
      recipientKey: 'user-dedupe',
      type: 't',
      title: 'One',
      body: '',
      data: {},
      priority: 0,
      channels: ['inapp', 'email'],
      dedupeKey: 'unique-1',
    })
    const second = await publishNotification({
      app: app(),
      recipientKey: 'user-dedupe',
      type: 't',
      title: 'One again',
      body: '',
      data: {},
      priority: 0,
      channels: ['inapp', 'email'],
      dedupeKey: 'unique-1',
    })
    expect(second.duplicate).toBe(true)
    expect(second.id).toBe(first.id)
    const deliveries = await getBusinessDb()
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.notificationId, first.id))
    expect(deliveries).toHaveLength(1)
  })

  test('a recipient opt-out removes the channel before the row is written', async () => {
    await setChannelPreference({ appId, recipientKey: 'user-optout', channel: 'email', enabled: false })
    const published = await publishNotification({
      app: app(),
      recipientKey: 'user-optout',
      type: 't',
      title: 'Email off',
      body: '',
      data: {},
      priority: 0,
      channels: ['inapp', 'email'],
    })
    expect(published.channels).toEqual(['inapp'])
    // inapp is delivered by the inbox row itself, so there is no outbox row at all.
    const deliveries = await getBusinessDb()
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.notificationId, published.id))
    expect(deliveries).toHaveLength(0)
  })
})

describe('inbox', () => {
  test('lists ascending with a cursor that never repeats a row', async () => {
    for (const title of ['A', 'B', 'C']) {
      await publishNotification({
        app: app(),
        recipientKey: 'user-page',
        type: 't',
        title,
        body: '',
        data: {},
        priority: 0,
        channels: ['inapp'],
      })
    }
    const page1 = await listInboxItems({ appId, recipientKey: 'user-page', limit: 2 })
    expect(page1.items.map((item) => item.title)).toEqual(['A', 'B'])
    expect(page1.next).not.toBeNull()

    const page2 = await listInboxItems({ appId, recipientKey: 'user-page', since: page1.next ?? undefined, limit: 2 })
    expect(page2.items.map((item) => item.title)).toEqual(['C'])
    expect(page2.next).toBeNull()
  })

  test('marking read is idempotent', async () => {
    const published = await publishNotification({
      app: app(),
      recipientKey: 'user-read',
      type: 't',
      title: 'Read me',
      body: '',
      data: {},
      priority: 0,
      channels: ['inapp'],
    })
    publishResultSchema.parse(published)
    expect(await markNotificationsRead({ appId, recipientKey: 'user-read', ids: [published.id] })).toBe(1)
    expect(await markNotificationsRead({ appId, recipientKey: 'user-read', ids: [published.id] })).toBe(0)
    const page = await listInboxItems({ appId, recipientKey: 'user-read' })
    expect(page.items[0]?.readAt).not.toBeNull()
  })

  test('email-only notifications stay out of the inbox and the unread count', async () => {
    const base = { app: app(), recipientKey: 'user-inapp', type: 't', body: '', data: {}, priority: 0 }
    const emailOnly = await publishNotification({ ...base, title: 'Email only', channels: ['email'] })
    const inbox = await publishNotification({ ...base, title: 'In app', channels: ['inapp'] })
    expect(emailOnly.channels).toEqual(['email'])

    const page = await listInboxItems({ appId, recipientKey: 'user-inapp' })
    expect(page.items.map((item) => item.title)).toEqual(['In app'])
    expect((await countInbox({ appId, recipientKey: 'user-inapp' })).unread).toBe(1)

    await markNotificationsRead({ appId, recipientKey: 'user-inapp', ids: [inbox.id] })
    expect((await countInbox({ appId, recipientKey: 'user-inapp' })).unread).toBe(0)
  })

  test('newest-first returns the latest page and no cursor', async () => {
    for (const title of ['X', 'Y', 'Z']) {
      await publishNotification({
        app: app(),
        recipientKey: 'user-desc',
        type: 't',
        title,
        body: '',
        data: {},
        priority: 0,
        channels: ['inapp'],
      })
    }
    const page = await listInboxItems({ appId, recipientKey: 'user-desc', order: 'desc', limit: 2 })
    expect(page.items.map((item) => item.title)).toEqual(['Z', 'Y'])
    expect(page.next).not.toBeNull()
    const older = await listInboxItems({
      appId,
      recipientKey: 'user-desc',
      order: 'desc',
      limit: 2,
      before: page.next ?? undefined,
    })
    expect(older.items.map((item) => item.title)).toEqual(['X'])
    expect(older.next).toBeNull()
  })

  test('archiving marks the row read and moves it out of the inbox and the badge', async () => {
    const recipientKey = 'user-archive'
    const published = await publishNotification({
      app: app(),
      recipientKey,
      type: 't',
      title: 'Archive me',
      body: '',
      data: {},
      priority: 0,
      channels: ['inapp'],
    })
    expect(await countInbox({ appId, recipientKey })).toEqual({ total: 1, unread: 1 })
    expect(await archiveNotifications({ appId, recipientKey, ids: [published.id] })).toBe(1)
    // Archived rows leave both the header total and the badge.
    expect(await countInbox({ appId, recipientKey })).toEqual({ total: 0, unread: 0 })
    const inbox = await listInboxItems({ appId, recipientKey })
    expect(inbox.items.map((item) => item.id)).not.toContain(published.id)
    const archived = await listInboxItems({ appId, recipientKey, view: 'archived' })
    expect(archived.items.map((item) => item.id)).toEqual([published.id])
    expect(archived.items[0]?.readAt).not.toBeNull()
  })

  test('archive-read archives only the rows already read, and restore brings one back', async () => {
    const recipientKey = 'user-archive-read'
    const readOne = await publishNotification({
      app: app(),
      recipientKey,
      type: 't',
      title: 'read',
      body: '',
      data: {},
      priority: 0,
      channels: ['inapp'],
    })
    const unreadOne = await publishNotification({
      app: app(),
      recipientKey,
      type: 't',
      title: 'unread',
      body: '',
      data: {},
      priority: 0,
      channels: ['inapp'],
    })
    await markNotificationsRead({ appId, recipientKey, ids: [readOne.id] })
    expect(await archiveNotifications({ appId, recipientKey, read: true })).toBe(1)
    const archived = await listInboxItems({ appId, recipientKey, view: 'archived' })
    expect(archived.items.map((item) => item.id)).toEqual([readOne.id])
    const inbox = await listInboxItems({ appId, recipientKey })
    expect(inbox.items.map((item) => item.id)).toEqual([unreadOne.id])
    expect(await restoreNotifications({ appId, recipientKey, ids: [readOne.id] })).toBe(1)
    const restored = await listInboxItems({ appId, recipientKey })
    expect(restored.items.map((item) => item.id)).toContain(readOne.id)
  })

  test('an archived row drops out of the listing once its 30-day window has passed', async () => {
    const recipientKey = 'user-retention'
    const published = await publishNotification({
      app: app(),
      recipientKey,
      type: 't',
      title: 'Old',
      body: '',
      data: {},
      priority: 0,
      channels: ['inapp'],
    })
    await archiveNotifications({ appId, recipientKey, ids: [published.id] })
    const later = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000)
    const archived = await listInboxItems({ appId, recipientKey, view: 'archived', now: later })
    expect(archived.items).toHaveLength(0)
    const removed = await purgeArchivedNotifications(getBusinessDb(), later)
    expect(removed).toBeGreaterThanOrEqual(1)
    const [gone] = await getBusinessDb().select().from(notifications).where(eq(notifications.id, published.id))
    expect(gone).toBeUndefined()
  })
})

// Reads SSE frames until the wanted title arrives, then cancels the live stream.
async function readNotificationTitles(response: Response, untilTitle: string): Promise<string[]> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('stream has no body')
  const decoder = new TextDecoder()
  let text = ''
  while (!text.includes(`"title":"${untilTitle}"`)) {
    const { value, done } = await reader.read()
    if (done) break
    text += decoder.decode(value)
  }
  await reader.cancel()
  const titles: string[] = []
  for (const frame of text.split('\n\n')) {
    const data = frame.split('\n').find((line) => line.startsWith('data: '))
    if (frame.startsWith('event: notification') && data) {
      titles.push(notificationSchema.parse(JSON.parse(data.slice('data: '.length))).title)
    }
  }
  return titles
}

describe('inbox http', () => {
  const inboxRequest = (query: string, token: string) =>
    new Request(`http://localhost/api/v1/apps/${appKey}/inbox${query}`, {
      headers: { authorization: `Bearer ${token}` },
    })

  test('newest-first response carries the unread count and the stream resume cursor', async () => {
    const minted = await mintRecipientToken({ appId, recipientKey: 'user-http' })
    for (const title of ['P', 'Q']) {
      await publishNotification({
        app: app(),
        recipientKey: 'user-http',
        type: 't',
        title,
        body: '',
        data: {},
        priority: 0,
        channels: ['inapp'],
      })
    }
    const response = await listInboxData(inboxRequest('?order=desc&limit=5', minted.token), { appKey })
    const { data } = await response.json()
    inboxPageSchema.parse(data)
    expect(data.items.map((item: { title: string }) => item.title)).toEqual(['Q', 'P'])
    expect(data.unread).toBe(2)
    expect(data.total).toBe(2)
    expect(data.latest).toBe(encodeCursor({ t: data.items[0].createdAt, i: data.items[0].id }))
  })

  test('a lastEventId query resumes the stream after that row', async () => {
    const minted = await mintRecipientToken({ appId, recipientKey: 'user-stream' })
    for (const title of ['S1', 'S2', 'S3']) {
      await publishNotification({
        app: app(),
        recipientKey: 'user-stream',
        type: 't',
        title,
        body: '',
        data: {},
        priority: 0,
        channels: ['inapp'],
      })
    }
    const first = await listInboxItems({ appId, recipientKey: 'user-stream', limit: 1 })
    const resume = `http://localhost/api/v1/apps/${appKey}/stream?token=${minted.token}&lastEventId=${first.next}`
    const response = await streamInboxData(new Request(resume), { appKey })
    expect(await readNotificationTitles(response, 'S3')).toEqual(['S2', 'S3'])
  })

  test('a bearer header opens the stream, so the token never has to be in the URL', async () => {
    const minted = await mintRecipientToken({ appId, recipientKey: 'user-stream-header' })
    await publishNotification({
      app: app(),
      recipientKey: 'user-stream-header',
      type: 't',
      title: 'H1',
      body: '',
      data: {},
      priority: 0,
      channels: ['inapp'],
    })
    const request = new Request(`http://localhost/api/v1/apps/${appKey}/stream`, {
      headers: { authorization: `Bearer ${minted.token}` },
    })
    const response = await streamInboxData(request, { appKey })
    expect(response.status).toBe(HttpStatus.OK.code)
    expect(await readNotificationTitles(response, 'H1')).toEqual(['H1'])
  })

  test('a malformed lastEventId is a 400 before the stream opens', async () => {
    const minted = await mintRecipientToken({ appId, recipientKey: 'user-bad-cursor' })
    const request = new Request(
      `http://localhost/api/v1/apps/${appKey}/stream?token=${minted.token}&lastEventId=not-a-cursor`,
    )
    const response = await withContext(async () => streamInboxData(request, { appKey }))({ request })
    expect(response.status).toBe(HttpStatus.BAD_REQUEST.code)
    expect((await response.json()).error.code).toBe(ErrorCode.VALIDATION_ERROR.code)
  })
})

describe('recipient tokens', () => {
  test('verifies a minted token for its own app and expires on time', async () => {
    const now = new Date('2026-10-28T00:00:00.000Z')
    const minted = await mintRecipientToken({ appId, recipientKey: 'user-token', now })
    expect(await verifyRecipientToken({ token: minted.token, appId, now })).toEqual({
      recipientKey: 'user-token',
      expiresAt: minted.expiresAt,
    })
    const later = new Date(now.getTime() + 16 * 60_000)
    expect(await verifyRecipientToken({ token: minted.token, appId, now: later })).toBeNull()
  })

  test('rejects a token belonging to another app', async () => {
    const minted = await mintRecipientToken({ appId, recipientKey: 'user-token', now: new Date() })
    expect(await verifyRecipientToken({ token: minted.token, appId: 'another-app' })).toBeNull()
  })
})

describe('channel delivery worker', () => {
  // Every earlier test in this file leaves pending deliveries behind; the worker
  // claims globally, so each case starts from a drained queue for this app.
  beforeEach(async () => {
    const ids = await getBusinessDb()
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.appId, appId))
    if (ids.length === 0) return
    await getBusinessDb()
      .update(notificationDeliveries)
      .set({ status: 'delivered' })
      .where(
        inArray(
          notificationDeliveries.notificationId,
          ids.map((row) => row.id),
        ),
      )
  })

  const stub = (behaviour: () => Promise<void>): NotificationChannel => ({
    id: 'email',
    apiVersion: 1,
    channel: 'email',
    describe: () => ({ id: 'email', apiVersion: 1, enabled: true, detail: 'stub', facts: [], channels: ['email'] }),
    send: behaviour,
  })

  test('claims a pending delivery and marks it delivered', async () => {
    const published = await publishNotification({
      app: app(),
      recipientKey: 'user-worker',
      type: 't',
      title: 'Deliver me',
      body: '',
      data: {},
      priority: 0,
      channels: ['email'],
    })
    let sends = 0
    const processed = await deliverPendingChannelDeliveries(getBusinessDb(), new Date(), [
      stub(async () => {
        sends += 1
      }),
    ])
    expect(processed).toBeGreaterThan(0)
    expect(sends).toBe(1)
    const [delivery] = await getBusinessDb()
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.notificationId, published.id))
    expect(delivery?.status).toBe('delivered')
  })

  test('retries with backoff, then dead-letters at the attempt ceiling', async () => {
    const published = await publishNotification({
      app: app(),
      recipientKey: 'user-failing',
      type: 't',
      title: 'Never deliver',
      body: '',
      data: {},
      priority: 0,
      channels: ['email'],
    })
    const failing = stub(async () => {
      throw new ChannelError('NO_RECIPIENT_ADDRESS')
    })
    const start = new Date()
    // Eight attempts, each at the moment the previous backoff becomes due.
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      await deliverPendingChannelDeliveries(getBusinessDb(), new Date(start.getTime() + attempt * 3_600_000), [failing])
    }
    const [delivery] = await getBusinessDb()
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.notificationId, published.id))
    expect(delivery?.status).toBe('dead_letter')
    expect(delivery?.attempts).toBe(8)
    expect(delivery?.lastError).toBe('NO_RECIPIENT_ADDRESS')
  })

  test('a stop signal hands the unsent claim back at once, attempt undone', async () => {
    const published = await publishNotification({
      app: app(),
      recipientKey: 'user-stopping',
      type: 't',
      title: 'Hand back',
      body: '',
      data: {},
      priority: 0,
      channels: ['email'],
    })
    const stopping = new AbortController()
    stopping.abort()
    let sends = 0
    await deliverPendingChannelDeliveries(
      getBusinessDb(),
      new Date(),
      [
        stub(async () => {
          sends += 1
        }),
      ],
      stopping.signal,
    )
    expect(sends).toBe(0)
    const [delivery] = await getBusinessDb()
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.notificationId, published.id))
    expect(delivery?.status).toBe('pending')
    expect(delivery?.attempts).toBe(0)
    expect(delivery?.nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now())
  })

  test('dead-letters immediately when no plugin owns the channel', async () => {
    const published = await publishNotification({
      app: app(),
      recipientKey: 'user-nochannel',
      type: 't',
      title: 'Nobody home',
      body: '',
      data: {},
      priority: 0,
      channels: ['email'],
    })
    await deliverPendingChannelDeliveries(getBusinessDb(), new Date(Date.now() + 1_000), [])
    const [delivery] = await getBusinessDb()
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.notificationId, published.id))
    expect(delivery?.status).toBe('dead_letter')
    expect(delivery?.lastError).toBe('CHANNEL_NOT_REGISTERED')
  })

  test('a non-retryable failure dead-letters on its first attempt', async () => {
    const published = await publishNotification({
      app: app(),
      recipientKey: 'user-gone-receiver',
      type: 't',
      title: 'Receiver is gone',
      body: '',
      data: {},
      priority: 0,
      channels: ['email'],
    })
    const gone = stub(async () => {
      throw new ChannelError('WEBHOOK_HTTP_404', 'Receiver answered 404', { retryable: false })
    })
    await deliverPendingChannelDeliveries(getBusinessDb(), new Date(Date.now() + 1_000), [gone])
    const [delivery] = await getBusinessDb()
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.notificationId, published.id))
    expect(delivery?.status).toBe('dead_letter')
    expect(delivery?.attempts).toBe(1)
    expect(delivery?.lastError).toBe('WEBHOOK_HTTP_404')
  })

  test('a delivered email drops its one-shot address', async () => {
    const published = await publishNotification({
      app: app(),
      recipientKey: 'user-one-shot-sent',
      type: 't',
      title: 'One shot',
      body: '',
      data: {},
      priority: 0,
      channels: ['email'],
      emailOverride: 'once@example.com',
    })
    await deliverPendingChannelDeliveries(getBusinessDb(), new Date(Date.now() + 1_000), [stub(async () => {})])
    const [delivery] = await getBusinessDb()
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.notificationId, published.id))
    expect(delivery?.status).toBe('delivered')
    expect(delivery?.addressOverride).toBeNull()
  })

  test('a dead-lettered email keeps its one-shot address, so a requeue still sends to it', async () => {
    const published = await publishNotification({
      app: app(),
      recipientKey: 'user-one-shot-requeued',
      type: 't',
      title: 'Requeue me',
      body: '',
      data: {},
      priority: 0,
      channels: ['email'],
      emailOverride: 'requeued@example.com',
    })
    const gone = stub(async () => {
      throw new ChannelError('WEBHOOK_HTTP_404', 'Receiver answered 404', { retryable: false })
    })
    await deliverPendingChannelDeliveries(getBusinessDb(), new Date(Date.now() + 1_000), [gone])
    const [dead] = await getBusinessDb()
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.notificationId, published.id))
    expect(dead?.status).toBe('dead_letter')
    expect(dead?.addressOverride).toBe('requeued@example.com')
    expect(await requeueDeadLetter(getBusinessDb(), dead?.id ?? '')).toBe(true)
    const [requeued] = await getBusinessDb()
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.id, dead?.id ?? ''))
    expect(requeued?.status).toBe('pending')
    expect(requeued?.addressOverride).toBe('requeued@example.com')
  })
})

// A dedicated app keeps these assertions independent of the other suites' rows.
describe('dashboard stats', () => {
  const STATS_APP = 'integration-stats'
  const statsApp = { id: '', key: '', name: STATS_APP }

  beforeAll(async () => {
    const created = await createApp(null, { name: STATS_APP, origin: 'https://stats-integration.test' })
    statsApp.id = created.id
    statsApp.key = created.key
  })

  afterAll(async () => {
    if (statsApp.key) await deleteApp(statsApp.key)
  })

  test('per-app totals, series, and breakdowns', async () => {
    const first = await publishNotification({
      app: statsApp,
      recipientKey: 'stats-user-1',
      type: 'comment.reply',
      title: 'One',
      body: '',
      data: {},
      priority: 0,
      channels: ['email'],
    })
    await publishNotification({
      app: statsApp,
      recipientKey: 'stats-user-2',
      type: 'mention',
      title: 'Two',
      body: '',
      data: {},
      priority: 0,
      channels: ['email'],
    })
    expect(await markNotificationsRead({ appId: statsApp.id, recipientKey: 'stats-user-1', ids: [first.id] })).toBe(1)

    const stats = await getAppStats(statsApp.id, 7)
    expect(stats.totals).toMatchObject({ published: 2, read: 1, recipients: 2, delivered: 0, deadLetter: 0 })
    expect(stats.series).toHaveLength(7)
    expect(stats.series.at(-1)?.published).toBe(2)
    expect(stats.series.at(-1)?.read).toBe(1)
    expect(stats.window.published).toBe(2)
    expect(stats.byChannel).toContainEqual({ channel: 'email', delivered: 0, deadLetter: 0 })
    expect(stats.topTypes.reduce((sum, row) => sum + row.total, 0)).toBe(2)
    expect(stats.topRecipients.reduce((sum, row) => sum + row.total, 0)).toBe(2)
  })

  test('fleet stats scope to the given apps and zero out an empty scope', async () => {
    const fleet = await getFleetStats([statsApp.id], 7)
    expect(fleet.totals.published).toBe(2)
    expect(fleet.topApps[0]).toMatchObject({ appKey: statsApp.key, appName: STATS_APP, total: 2 })

    const none = await getFleetStats([], 7)
    expect(none.totals.published).toBe(0)
    expect(none.series).toHaveLength(7)
    expect(none.byChannel).toEqual([])
    expect(none.topApps).toEqual([])
  })

  test('a backdated notification counts in totals but not in the window', async () => {
    await publishNotification({
      app: statsApp,
      recipientKey: 'stats-user-3',
      type: 'comment.reply',
      title: 'Old',
      body: '',
      data: {},
      priority: 0,
      channels: ['inapp'],
    })
    await getBusinessDb()
      .update(notifications)
      .set({ createdAt: new Date(Date.now() - 8 * 86_400_000) })
      .where(and(eq(notifications.appId, statsApp.id), eq(notifications.recipientKey, 'stats-user-3')))

    const stats = await getAppStats(statsApp.id, 7)
    expect(stats.totals.published).toBe(3)
    expect(stats.window.published).toBe(2)
    expect(stats.topTypes.reduce((sum, row) => sum + row.total, 0)).toBe(2)
  })
})

describe('retention and retry rules', () => {
  const DAY_MS = 24 * 60 * 60 * 1000

  test('the delivered-email pass never removes an inbox row, read or unread', async () => {
    const recipientKey = 'user-kept-inbox'
    const kept = await publishNotification({
      app: app(),
      recipientKey,
      type: 't',
      title: 'Unread for a month',
      body: '',
      data: {},
      priority: 0,
      channels: ['inapp'],
    })
    await purgeDeliveredNotifications(getBusinessDb(), new Date(Date.now() + 31 * DAY_MS))
    const [row] = await getBusinessDb().select().from(notifications).where(eq(notifications.id, kept.id))
    expect(row).toBeDefined()
  })

  test('the delivered-email pass removes an email-only notification once its delivery finished', async () => {
    const published = await publishNotification({
      app: app(),
      recipientKey: 'user-email-only',
      type: 't',
      title: 'Mail only',
      body: '',
      data: {},
      priority: 0,
      channels: ['email'],
      emailOverride: 'reader@example.com',
    })
    await getBusinessDb()
      .update(notificationDeliveries)
      .set({ status: 'delivered' })
      .where(eq(notificationDeliveries.notificationId, published.id))
    await purgeDeliveredNotifications(getBusinessDb(), new Date(Date.now() + 31 * DAY_MS))
    const [gone] = await getBusinessDb().select().from(notifications).where(eq(notifications.id, published.id))
    expect(gone).toBeUndefined()
  })

  test('a retry requeues only a dead letter, never a row that is pending, processing, or delivered', async () => {
    const db = getBusinessDb()
    const published = await publishNotification({
      app: app(),
      recipientKey: 'user-retry',
      type: 't',
      title: 'Retry',
      body: '',
      data: {},
      priority: 0,
      channels: ['email'],
      emailOverride: 'reader@example.com',
    })
    const [delivery] = await db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.notificationId, published.id))
    const setStatus = (status: 'pending' | 'processing' | 'delivered' | 'dead_letter') =>
      db.update(notificationDeliveries).set({ status }).where(eq(notificationDeliveries.id, delivery.id))

    await setStatus('processing')
    expect(await requeueDeadLetter(db, delivery.id)).toBe(false)
    await setStatus('delivered')
    expect(await requeueDeadLetter(db, delivery.id)).toBe(false)
    await setStatus('dead_letter')
    expect(await requeueDeadLetter(db, delivery.id)).toBe(true)

    const [after] = await db.select().from(notificationDeliveries).where(eq(notificationDeliveries.id, delivery.id))
    expect(after?.status).toBe('pending')
  })
})

describe('unsubscribe link', () => {
  const recipientKey = 'user-unsubscribe'
  const email = 'reader@example.com'
  const linkFor = (token: string) => {
    const params = new URLSearchParams({ appKey, recipientKey, email, token })
    return `https://notifications-integration.test/api/v1/unsubscribe?${params}`
  }
  const validToken = () => createUnsubscribeToken(appId, recipientKey, email)
  const emailEnabled = async () => (await getChannelPreferences({ appId, recipientKey }))['email'] ?? true

  test('GET shows the confirmation and leaves email on', async () => {
    const response = await unsubscribeConfirmData(new Request(linkFor(validToken())))
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<form method="post">')
    expect(await emailEnabled()).toBe(true)
  })

  test('GET with a bad token is refused and changes nothing', async () => {
    await expect(unsubscribeConfirmData(new Request(linkFor('forged')))).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await emailEnabled()).toBe(true)
  })

  test('POST turns email off, and a one-click client gets JSON', async () => {
    const response = await unsubscribeData(new Request(linkFor(validToken()), { method: 'POST' }))
    expect(await response.json()).toEqual({ data: { unsubscribed: true } })
    expect(await emailEnabled()).toBe(false)
  })

  test('a browser form POST gets the done page', async () => {
    await setChannelPreference({ appId, recipientKey, channel: 'email', enabled: true })
    const response = await unsubscribeData(
      new Request(linkFor(validToken()), { method: 'POST', headers: { accept: 'text/html' } }),
    )
    expect(await response.text()).toContain('You are unsubscribed')
    expect(await emailEnabled()).toBe(false)
  })
})
