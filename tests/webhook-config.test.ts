import { describe, expect, test } from 'bun:test'

import { contactBodySchema } from '@/server/modules/notifications/http/notification-schemas'
import { getWebhookPluginSettings } from '@/server/plugins/webhook/webhook.config'

describe('webhook plugin settings', () => {
  test('no secret means unsigned deliveries are off', () => {
    expect(getWebhookPluginSettings({ env: {} }).signingSecret).toBeUndefined()
  })

  test('a secret shorter than 16 characters is not accepted', () => {
    expect(getWebhookPluginSettings({ env: { WEBHOOK_SIGNING_SECRET: 'short' } }).signingSecret).toBeUndefined()
  })

  test('a 16+ character secret is used and trimmed', () => {
    const settings = getWebhookPluginSettings({ env: { WEBHOOK_SIGNING_SECRET: '  0123456789abcdef  ' } })
    expect(settings.signingSecret).toBe('0123456789abcdef')
  })

  test('private networks stay blocked unless the development switch is on', () => {
    expect(getWebhookPluginSettings({ env: {} }).allowPrivateNetworks).toBe(false)
    expect(getWebhookPluginSettings({ env: { WEBHOOK_ALLOW_PRIVATE: 'true' } }).allowPrivateNetworks).toBe(true)
  })
})

describe('contact body schema', () => {
  test('the legacy {address} shape still means an email contact', () => {
    expect(contactBodySchema.parse({ address: 'person@example.com' })).toEqual({
      channel: 'email',
      address: 'person@example.com',
    })
  })

  test('an email contact must be a valid email address', () => {
    expect(contactBodySchema.safeParse({ address: 'not-an-email' }).success).toBe(false)
  })

  test('a webhook contact carries its URL as the address', () => {
    expect(contactBodySchema.parse({ channel: 'webhook', address: 'https://hooks.example.com/notify' })).toEqual({
      channel: 'webhook',
      address: 'https://hooks.example.com/notify',
    })
  })

  test('an unknown channel is refused', () => {
    expect(contactBodySchema.safeParse({ channel: 'sms', address: '+15550100' }).success).toBe(false)
  })
})
