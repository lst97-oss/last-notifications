import { afterEach, describe, expect, test } from 'bun:test'
import { randomBytes } from 'node:crypto'

import { appChannelSettings } from '@/server/plugins/channel-delivery'
import { sealSecret } from '@/server/security/secret-box'

// The worker turns an app's stored channel row into what a send may use. An unreadable secret must be
// flagged, never dropped: a dropped secret would make the send fall back to the server's own key.
const KEY = randomBytes(32).toString('base64')
const OTHER_KEY = randomBytes(32).toString('base64')
const APP_SECRET = 'app-webhook-secret-0123456789'
const originalKey = Bun.env.SECRET_ENCRYPTION_KEY

afterEach(() => {
  if (originalKey === undefined) delete Bun.env.SECRET_ENCRYPTION_KEY
  else Bun.env.SECRET_ENCRYPTION_KEY = originalKey
})

describe('appChannelSettings', () => {
  test('an app with no row gets the defaults and no secret', () => {
    expect(appChannelSettings(undefined)).toEqual({ config: {}, signingSecret: null, secretUnreadable: false })
  })

  test('a row without a secret keeps its config and has none', () => {
    expect(
      appChannelSettings({ config: { endpointUrl: 'https://hooks.example.test' }, signingSecretEncrypted: null }),
    ).toEqual({
      config: { endpointUrl: 'https://hooks.example.test' },
      signingSecret: null,
      secretUnreadable: false,
    })
  })

  test('a sealed secret opens with the server key', () => {
    Bun.env.SECRET_ENCRYPTION_KEY = KEY
    const sealed = sealSecret(APP_SECRET, { SECRET_ENCRYPTION_KEY: KEY })
    expect(appChannelSettings({ config: {}, signingSecretEncrypted: sealed })).toEqual({
      config: {},
      signingSecret: APP_SECRET,
      secretUnreadable: false,
    })
  })

  test('a secret sealed under another key is flagged unreadable, never dropped', () => {
    Bun.env.SECRET_ENCRYPTION_KEY = KEY
    const sealed = sealSecret(APP_SECRET, { SECRET_ENCRYPTION_KEY: OTHER_KEY })
    expect(appChannelSettings({ config: {}, signingSecretEncrypted: sealed })).toEqual({
      config: {},
      signingSecret: null,
      secretUnreadable: true,
    })
  })

  test('a sealed secret with no server key is flagged unreadable', () => {
    delete Bun.env.SECRET_ENCRYPTION_KEY
    const sealed = sealSecret(APP_SECRET, { SECRET_ENCRYPTION_KEY: KEY })
    expect(appChannelSettings({ config: {}, signingSecretEncrypted: sealed })).toEqual({
      config: {},
      signingSecret: null,
      secretUnreadable: true,
    })
  })
})
