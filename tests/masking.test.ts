import { describe, expect, test } from 'bun:test'

import { maskEmail, maskWebhookUrl } from '@/server/modules/notifications/domain/masking'

describe('masking', () => {
  test('an email keeps the first letter of its name and its domain', () => {
    expect(maskEmail('alice@example.com')).toBe('a***@example.com')
  })

  test('a one-letter name shows none of itself', () => {
    expect(maskEmail('a@example.com')).toBe('***@example.com')
  })

  test('a value with no usable name is hidden entirely', () => {
    expect(maskEmail('not-an-email')).toBe('***')
    expect(maskEmail('@example.com')).toBe('***')
  })

  test('a webhook shows only its origin, never the path or query that may carry a secret', () => {
    expect(maskWebhookUrl('https://hooks.example.com/a/secret-path?token=1')).toBe('https://hooks.example.com')
  })

  test('an unreadable webhook URL is hidden', () => {
    expect(maskWebhookUrl('not a url')).toBe('***')
  })
})
