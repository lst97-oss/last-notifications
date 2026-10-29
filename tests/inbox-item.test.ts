import { describe, expect, test } from 'bun:test'

import type { NotificationRecord } from '@/server/modules/notifications/domain/notification'
import { toInboxItem } from '@/server/modules/notifications/http/inbox-item'
import { notificationSchema } from '@/server/openapi/response-schemas'

const record: NotificationRecord = {
  id: '6f1c2b8e-3d4a-4e5f-9a1b-2c3d4e5f6a7b',
  appId: 'app-internal-id',
  recipientKey: 'user-42',
  type: 'comment.reply',
  title: 'New reply',
  body: 'Ada replied to you',
  data: { url: '/c/9' },
  priority: 1,
  dedupeKey: 'reply-9',
  readAt: null,
  archivedAt: null,
  createdAt: '2026-10-30T10:00:00.000Z',
}

describe('toInboxItem', () => {
  test('keeps the nine wire fields and drops the internal ids', () => {
    const item = toInboxItem(record)
    expect(Object.keys(item).sort()).toEqual(
      ['archivedAt', 'body', 'createdAt', 'data', 'id', 'priority', 'readAt', 'title', 'type'].sort(),
    )
    expect(item).toEqual({
      id: record.id,
      type: record.type,
      title: record.title,
      body: record.body,
      data: record.data,
      priority: record.priority,
      readAt: null,
      archivedAt: null,
      createdAt: record.createdAt,
    })
  })

  test('the projected item passes the strict Notification schema', () => {
    expect(notificationSchema.parse(toInboxItem(record))).toEqual(toInboxItem(record))
  })

  test('the strict schema refuses an internal id that leaks back in', () => {
    expect(notificationSchema.safeParse({ ...toInboxItem(record), recipientKey: 'user-42' }).success).toBe(false)
  })
})
