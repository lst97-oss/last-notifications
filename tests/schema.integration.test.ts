import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { and, eq } from 'drizzle-orm'

import { closeBusinessSql, getBusinessDb } from '@/server/db/business-sql'
import {
  notificationPreferences,
  notifications,
  pushSubscriptions,
  recipientContacts,
  recipients,
  recipientTokens,
} from '@/server/db/schema'
import { publishNotification } from '@/server/modules/notifications/application/publish-notification'
import {
  ensureRecipient,
  setChannelPreference,
  setRecipientChannelAddress,
} from '@/server/modules/notifications/infrastructure/notification-repository'
import { mintRecipientToken } from '@/server/modules/notifications/infrastructure/recipient-token-repository'
import { upsertPushSubscription } from '@/server/modules/notifications/infrastructure/push-subscription-repository'
import { createApp, deleteApp } from '@/server/modules/apps/infrastructure/app-repository'

// Live suite against BUSINESS_DATABASE_URL. Creates its own app and deletes it in afterAll,
// so the app cascade is also exercised here.
const APP_NAME = 'integration-schema'
const ORIGIN = 'https://schema-integration.test'
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

describe('recipient cascade', () => {
  test('deleting a recipient removes every row that references it, and nothing else', async () => {
    const db = getBusinessDb()
    const keep = 'cascade-keep'
    const gone = 'cascade-gone'
    for (const recipientKey of [gone, keep]) {
      await publishNotification({
        app: app(),
        recipientKey,
        type: 't',
        title: 'Hello',
        body: '',
        data: {},
        priority: 0,
        channels: ['inapp', 'email'],
      })
      await setRecipientChannelAddress({
        appId,
        recipientKey,
        channel: 'email',
        address: `${recipientKey}@example.com`,
      })
      await setChannelPreference({ appId, recipientKey, channel: 'email', enabled: false })
      await mintRecipientToken({ appId, recipientKey })
      await upsertPushSubscription({
        appId,
        recipientKey,
        endpoint: `https://push.example.test/${recipientKey}`,
        p256dh: 'p',
        auth: 'a',
      })
    }

    await db.delete(recipients).where(and(eq(recipients.appId, appId), eq(recipients.recipientKey, gone)))

    const rowsFor = async (recipientKey: string) => ({
      notifications: (
        await db
          .select()
          .from(notifications)
          .where(and(eq(notifications.appId, appId), eq(notifications.recipientKey, recipientKey)))
      ).length,
      contacts: (
        await db
          .select()
          .from(recipientContacts)
          .where(and(eq(recipientContacts.appId, appId), eq(recipientContacts.recipientKey, recipientKey)))
      ).length,
      preferences: (
        await db
          .select()
          .from(notificationPreferences)
          .where(and(eq(notificationPreferences.appId, appId), eq(notificationPreferences.recipientKey, recipientKey)))
      ).length,
      tokens: (
        await db
          .select()
          .from(recipientTokens)
          .where(and(eq(recipientTokens.appId, appId), eq(recipientTokens.recipientKey, recipientKey)))
      ).length,
      pushes: (
        await db
          .select()
          .from(pushSubscriptions)
          .where(and(eq(pushSubscriptions.appId, appId), eq(pushSubscriptions.recipientKey, recipientKey)))
      ).length,
    })

    expect(await rowsFor(gone)).toEqual({ notifications: 0, contacts: 0, preferences: 0, tokens: 0, pushes: 0 })
    expect(await rowsFor(keep)).toEqual({ notifications: 1, contacts: 1, preferences: 1, tokens: 1, pushes: 1 })
  })

  test('a recipient row is unique per app and key', async () => {
    await ensureRecipient(getBusinessDb(), { appId, recipientKey: 'unique-check' })
    const duplicate = getBusinessDb().insert(recipients).values({ appId, recipientKey: 'unique-check' })
    await expect(Promise.resolve(duplicate)).rejects.toThrow()
  })
})

describe('notification constraints', () => {
  test('an archived row must already be read', async () => {
    const published = await publishNotification({
      app: app(),
      recipientKey: 'archive-check',
      type: 't',
      title: 'Unread',
      body: '',
      data: {},
      priority: 0,
      channels: ['inapp'],
    })
    const archive = getBusinessDb()
      .update(notifications)
      .set({ archivedAt: new Date() })
      .where(eq(notifications.id, published.id))
    await expect(Promise.resolve(archive)).rejects.toThrow()
  })
})
