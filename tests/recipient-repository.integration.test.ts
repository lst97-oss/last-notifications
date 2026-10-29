import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { and, eq } from 'drizzle-orm'

import { closeBusinessSql, getBusinessDb } from '@/server/db/business-sql'
import { pushSubscriptions, recipients } from '@/server/db/schema'
import { publishNotification } from '@/server/modules/notifications/application/publish-notification'
import { ensureRecipient } from '@/server/modules/notifications/infrastructure/notification-repository'
import { listRecipientKeys } from '@/server/modules/notifications/infrastructure/recipient-repository'
import { upsertPushSubscription } from '@/server/modules/notifications/infrastructure/push-subscription-repository'
import { createApp, deleteApp } from '@/server/modules/apps/infrastructure/app-repository'

// Live suite against BUSINESS_DATABASE_URL. Two apps, deleted in afterAll: the second one proves
// that a row written under one app is invisible to the other.
const ORIGIN = 'https://recipient-integration.test'
const owner = { key: '', id: '', name: 'integration-recipients-owner' }
const other = { key: '', id: '', name: 'integration-recipients-other' }

beforeAll(async () => {
  const first = await createApp(null, { name: owner.name, origin: ORIGIN })
  owner.key = first.key
  owner.id = first.id
  const second = await createApp(null, { name: other.name, origin: ORIGIN })
  other.key = second.key
  other.id = second.id
})

afterAll(async () => {
  if (owner.key) await deleteApp(owner.key)
  if (other.key) await deleteApp(other.key)
  await closeBusinessSql()
})

describe('ensureRecipient', () => {
  test('is idempotent: a repeated call leaves exactly one row', async () => {
    const db = getBusinessDb()
    await ensureRecipient(db, { appId: owner.id, recipientKey: 'idempotent-user' })
    await ensureRecipient(db, { appId: owner.id, recipientKey: 'idempotent-user' })
    const rows = await db
      .select()
      .from(recipients)
      .where(and(eq(recipients.appId, owner.id), eq(recipients.recipientKey, 'idempotent-user')))
    expect(rows).toHaveLength(1)
  })
})

describe('listRecipientKeys', () => {
  test('includes a recipient that only ever received a notification', async () => {
    await publishNotification({
      app: { id: owner.id, key: owner.key, name: owner.name },
      recipientKey: 'list-notified-only',
      type: 't',
      title: 'Only a notification',
      body: '',
      data: {},
      priority: 0,
      channels: ['inapp'],
    })
    const { recipientKeys } = await listRecipientKeys({ appId: owner.id, limit: 1000, after: null })
    expect(recipientKeys).toContain('list-notified-only')
  })

  test('pages through every recipient once, in key order', async () => {
    const db = getBusinessDb()
    const keys = ['page-a', 'page-b', 'page-c', 'page-d', 'page-e']
    for (const recipientKey of keys) await ensureRecipient(db, { appId: other.id, recipientKey })

    const seen: string[] = []
    let after: string | null = null
    do {
      const page = await listRecipientKeys({ appId: other.id, limit: 2, after })
      seen.push(...page.recipientKeys)
      after = page.next
    } while (after !== null)

    // No key twice across pages, and this test's keys come back in order.
    expect(new Set(seen).size).toBe(seen.length)
    expect(seen.filter((key) => key.startsWith('page-'))).toEqual(keys)
  })
})

describe('push subscriptions', () => {
  test('an endpoint in one app never moves into another app', async () => {
    const endpoint = 'https://push.example.test/shared-browser-install'
    await upsertPushSubscription({ appId: owner.id, recipientKey: 'push-owner', endpoint, p256dh: 'p', auth: 'a' })
    await upsertPushSubscription({ appId: other.id, recipientKey: 'push-intruder', endpoint, p256dh: 'p', auth: 'a' })

    const rows = await getBusinessDb()
      .select({ appId: pushSubscriptions.appId, recipientKey: pushSubscriptions.recipientKey })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.appId === owner.id)?.recipientKey).toBe('push-owner')
    expect(rows.find((row) => row.appId === other.id)?.recipientKey).toBe('push-intruder')
  })

  test('re-subscribing within one app revives the row and reassigns it to the new recipient', async () => {
    const endpoint = 'https://push.example.test/same-app-reinstall'
    await upsertPushSubscription({ appId: owner.id, recipientKey: 'reinstall-old', endpoint, p256dh: 'p1', auth: 'a1' })
    await upsertPushSubscription({ appId: owner.id, recipientKey: 'reinstall-new', endpoint, p256dh: 'p2', auth: 'a2' })

    const rows = await getBusinessDb()
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.appId, owner.id), eq(pushSubscriptions.endpoint, endpoint)))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.recipientKey).toBe('reinstall-new')
    expect(rows[0]?.p256dh).toBe('p2')
  })
})
