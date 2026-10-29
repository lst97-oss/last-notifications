import { describe, expect, test } from 'bun:test'

import { publishBodySchema } from '@/server/modules/notifications/http/notification-schemas'

const publish = (data: Record<string, unknown>) =>
  publishBodySchema.safeParse({ recipientKey: 'user-1', type: 'comment.reply', title: 'Hi', data })

describe('publishBodySchema data', () => {
  test('accepts data within the JSON cap', () => {
    expect(publish({ url: 'https://app.example.com/thread/9' }).success).toBe(true)
  })

  test('refuses data over the JSON cap, since every inbox page and stream frame carries it', () => {
    const result = publish({ blob: 'x'.repeat(20 * 1024) })
    expect(result.success).toBe(false)
    expect(JSON.stringify(result.error?.issues ?? [])).toContain('data')
  })
})
