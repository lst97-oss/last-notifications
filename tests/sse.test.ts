import { describe, expect, test } from 'bun:test'

import type { NotificationRecord } from '@/server/modules/notifications/domain/notification'
import { encodeNotificationFrame } from '@/server/modules/notifications/http/sse'
import { notificationSchema } from '@/server/openapi/response-schemas'

const record: NotificationRecord = {
  id: '6f1c2b8e-3d4a-4e5f-9a1b-2c3d4e5f6a7b',
  appId: 'app-internal-id',
  recipientKey: 'user-42',
  type: 'comment.reply',
  title: 'New reply',
  body: '',
  data: {},
  priority: 0,
  dedupeKey: null,
  readAt: null,
  archivedAt: null,
  createdAt: '2026-10-30T10:00:00.000Z',
}

describe('encodeNotificationFrame', () => {
  test('data is one Notification object, and id is the inbox cursor', () => {
    const frame = encodeNotificationFrame({ cursor: 'cursor-1', notification: record })
    const lines = frame.split('\n')
    expect(lines[0]).toBe('event: notification')
    expect(frame.endsWith('\nid: cursor-1\n\n')).toBe(true)
    const data = JSON.parse(lines[1].slice('data: '.length))
    expect(notificationSchema.parse(data)).toEqual(data)
    expect(data).not.toHaveProperty('recipientKey')
  })
})
