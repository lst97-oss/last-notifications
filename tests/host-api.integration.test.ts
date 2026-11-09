import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomBytes } from 'node:crypto'

import { eq } from 'drizzle-orm'

import type { ApiKeyScope } from '@/lib/api-key-scopes'
import { closeBusinessSql, getBusinessDb, getBusinessSql } from '@/server/db/business-sql'
import {
  createAppData,
  getAppChannelsData,
  listAppsData,
  patchAppChannelData,
  updateAppData,
} from '@/server/modules/admin/http/admin-apps'
import { openSecret } from '@/server/security/secret-box'
import { user } from '@/server/db/schema'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { deleteServiceKey, issueServiceKey } from '@/server/modules/api-keys/infrastructure/api-key-repository'
import { createApp, deleteApp, getAppChannelSettings } from '@/server/modules/apps/infrastructure/app-repository'
import { publishNotification } from '@/server/modules/notifications/application/publish-notification'
import {
  getChannelsData,
  putWebhookChannelData,
  rotateWebhookSecretData,
} from '@/server/modules/notifications/http/channel-config-handler'
import {
  deleteNotificationData,
  mintRecipientTokenData,
  setContactData,
} from '@/server/modules/notifications/http/notification-handler'
import {
  clearContactData,
  getRecipientData,
  listRecipientsData,
} from '@/server/modules/notifications/http/recipient-handler'
import {
  setChannelPreference,
  setRecipientChannelAddress,
} from '@/server/modules/notifications/infrastructure/notification-repository'
import {
  contactClearedSchema,
  deletedSchema,
  recipientPageSchema,
  recipientSummarySchema,
  recipientTokenSchema,
  webhookChannelSchema,
  webhookConfiguredSchema,
  webhookSecretSchema,
} from '@/server/openapi/response-schemas'

// Exercises the host API end to end against the business database: real keys with real
// permissions, real app bindings, real sealed secrets. Each run makes its own apps and keys and
// removes them afterwards.
const suffix = Date.now().toString(36)
const OWNER = `int-owner-${suffix}`
const originalKey = Bun.env.SECRET_ENCRYPTION_KEY

let userId = ''
let appA = { id: '', key: '' }
let appB = { id: '', key: '' }
const issued: { id: string; secret: string }[] = []
const keys: Record<string, string> = {}

async function issue(name: string, app: { key: string }, scopes: ApiKeyScope[]): Promise<string> {
  const created = await issueServiceKey({ userId, name, appKey: app.key, scopes })
  issued.push({ id: created.id, secret: created.key })
  return created.key
}

function request(key: string | null, body?: unknown): Request {
  return new Request('http://localhost/api/v1/test', {
    method: 'POST',
    headers: {
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

// Calls a host route and returns the envelope's data, or the refusal code it raised.
async function run(call: () => Promise<Response>): Promise<{ data?: any; code?: string }> {
  try {
    const response = await call()
    return { data: (await response.json()).data }
  } catch (error) {
    if (error instanceof HttpError) return { code: error.code }
    throw error
  }
}

beforeAll(async () => {
  Bun.env.SECRET_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  await getBusinessDb()
    .insert(user)
    .values({ id: OWNER, name: 'Integration owner', email: `${OWNER}@example.test` })
  userId = OWNER
  appA = await createApp(null, { name: `host-a-${suffix}`, origin: `https://host-a-${suffix}.test` })
  appB = await createApp(null, { name: `host-b-${suffix}`, origin: `https://host-b-${suffix}.test` })
  keys.publisher = await issue('publisher', appA, ['notifications:create', 'notifications:read'])
  keys.integration = await issue('integration', appA, [
    'recipients:read',
    'recipients:update',
    'recipients:delete',
    'channels:read',
    'channels:update',
    'tokens:create',
  ])
  keys.janitor = await issue('janitor', appA, ['notifications:delete'])
  keys.tokens = await issue('tokens', appA, ['tokens:create'])
  keys.otherApp = await issue('other-app', appB, ['channels:update', 'channels:read', 'recipients:read'])
})

afterAll(async () => {
  for (const key of issued) await deleteServiceKey(key.id)
  if (appA.key) await deleteApp(appA.key)
  if (appB.key) await deleteApp(appB.key)
  await getBusinessDb().delete(user).where(eq(user.id, OWNER))
  await closeBusinessSql()
  if (originalKey === undefined) delete Bun.env.SECRET_ENCRYPTION_KEY
  else Bun.env.SECRET_ENCRYPTION_KEY = originalKey
})

describe('webhook channel registration', () => {
  test('registering issues a secret once, and reads never return it', async () => {
    const first = await run(() =>
      putWebhookChannelData(request(keys.integration, { endpointUrl: 'https://receiver.example.test/hook' }), {
        appKey: appA.key,
      }),
    )
    expect(first.data.secretConfigured).toBe(true)
    expect(first.data.secret).toMatch(/^[0-9a-f]{64}$/)
    webhookConfiguredSchema.parse(first.data)

    const again = await run(() =>
      putWebhookChannelData(request(keys.integration, { endpointUrl: 'https://receiver.example.test/hook' }), {
        appKey: appA.key,
      }),
    )
    expect(again.data.secret).toBeUndefined()
    webhookConfiguredSchema.parse(again.data)

    const listed = await run(() => getChannelsData(request(keys.integration), { appKey: appA.key }))
    expect(listed.data.channels[0]).toEqual({
      channel: 'webhook',
      enabled: true,
      endpointUrl: 'https://receiver.example.test/hook',
      secretConfigured: true,
    })
    expect(JSON.stringify(listed.data)).not.toContain(first.data.secret)
    webhookChannelSchema.parse(listed.data.channels[0])

    const stored = JSON.stringify(await getAppChannelSettings(appA.id))
    expect(stored).not.toContain(first.data.secret)
  })

  test('rotating issues a different secret', async () => {
    const before = await run(() => rotateWebhookSecretData(request(keys.integration), { appKey: appA.key }))
    const after = await run(() => rotateWebhookSecretData(request(keys.integration), { appKey: appA.key }))
    expect(after.data.secret).toMatch(/^[0-9a-f]{64}$/)
    expect(after.data.secret).not.toBe(before.data.secret)
    webhookSecretSchema.parse(after.data)
  })

  test('a private or loopback endpoint is refused by the same URL policy as recipients', async () => {
    const refused = await run(() =>
      putWebhookChannelData(request(keys.integration, { endpointUrl: 'https://10.0.0.5/hook' }), {
        appKey: appA.key,
      }),
    )
    expect(refused.code).toBe(ErrorCode.VALIDATION_ERROR.code)
  })

  test('a publisher key cannot change delivery settings, and a key for another app cannot touch this one', async () => {
    const publisher = await run(() =>
      putWebhookChannelData(request(keys.publisher, { endpointUrl: 'https://receiver.example.test/x' }), {
        appKey: appA.key,
      }),
    )
    expect(publisher.code).toBe(ErrorCode.INSUFFICIENT_SCOPE.code)

    const wrongApp = await run(() =>
      putWebhookChannelData(request(keys.otherApp, { endpointUrl: 'https://receiver.example.test/x' }), {
        appKey: appA.key,
      }),
    )
    expect(wrongApp.code).toBe(ErrorCode.INSUFFICIENT_SCOPE.code)
  })

  test('two first registrations at once issue one secret, and the stored secret is the one returned', async () => {
    const register = () =>
      run(() =>
        putWebhookChannelData(request(keys.otherApp, { endpointUrl: 'https://race.example.test/hook' }), {
          appKey: appB.key,
        }),
      )
    const results = await Promise.all([register(), register()])
    const issued = results.filter((result) => typeof result.data?.secret === 'string')
    expect(issued).toHaveLength(1)
    expect(results.every((result) => result.data?.secretConfigured === true)).toBe(true)

    const [row] =
      await getBusinessSql()`select signing_secret_encrypted from app_channels where app_id = ${appB.id} and channel = 'webhook'`
    expect(openSecret(String(row?.signing_secret_encrypted))).toBe(issued[0]?.data.secret)
  })
})

describe('recipients', () => {
  beforeAll(async () => {
    await setRecipientChannelAddress({
      appId: appA.id,
      recipientKey: 'int-alice',
      channel: 'email',
      address: 'alice@example.test',
    })
    await setRecipientChannelAddress({
      appId: appA.id,
      recipientKey: 'int-alice',
      channel: 'webhook',
      address: 'https://alice-hooks.example.test/notify?token=secret-path',
    })
    await setChannelPreference({ appId: appA.id, recipientKey: 'int-alice', channel: 'webpush', enabled: false })
  })

  test('a recipient reads back masked, with booleans and no raw address', async () => {
    const summary = await run(() =>
      getRecipientData(request(keys.integration), { appKey: appA.key, recipientKey: 'int-alice' }),
    )
    expect(summary.data).toEqual({
      recipientKey: 'int-alice',
      email: { set: true, masked: 'a***@example.test' },
      webhook: { set: true, masked: 'https://alice-hooks.example.test' },
      push: { subscriptions: 0 },
      preferences: { webpush: false },
    })
    expect(JSON.stringify(summary.data)).not.toContain('secret-path')
    recipientSummarySchema.parse(summary.data)
  })

  test('reading a recipient needs a key with recipients:read, and a publisher key is refused', async () => {
    const refused = await run(() =>
      getRecipientData(request(keys.publisher), { appKey: appA.key, recipientKey: 'int-alice' }),
    )
    expect(refused.code).toBe(ErrorCode.INSUFFICIENT_SCOPE.code)
    const anonymous = await run(() => getRecipientData(request(null), { appKey: appA.key, recipientKey: 'int-alice' }))
    expect(anonymous.code).toBe(ErrorCode.INVALID_API_KEY.code)
  })

  test('the recipient list pages through every key once, in byte order', async () => {
    await setRecipientChannelAddress({
      appId: appA.id,
      recipientKey: 'int-bob',
      channel: 'email',
      address: 'bob@example.test',
    })
    await setChannelPreference({ appId: appA.id, recipientKey: 'int-carol', channel: 'email', enabled: true })

    const first = await run(() => listRecipientsData(request(keys.integration), { appKey: appA.key }))
    expect(first.data.recipients).toEqual(['int-alice', 'int-bob', 'int-carol'])
    expect(first.data.next).toBeNull()
    recipientPageSchema.parse(first.data)

    const paged = new Request(`http://localhost/api/v1/apps/${appA.key}/recipients?limit=2`, {
      headers: { authorization: `Bearer ${keys.integration}` },
    })
    const page1 = await run(() => listRecipientsData(paged, { appKey: appA.key }))
    expect(page1.data.recipients).toEqual(['int-alice', 'int-bob'])
    expect(page1.data.next).not.toBeNull()

    const next = new Request(`http://localhost/api/v1/apps/${appA.key}/recipients?limit=2&cursor=${page1.data.next}`, {
      headers: { authorization: `Bearer ${keys.integration}` },
    })
    const page2 = await run(() => listRecipientsData(next, { appKey: appA.key }))
    expect(page2.data.recipients).toEqual(['int-carol'])
    expect(page2.data.next).toBeNull()
  })

  test('clearing a contact is idempotent, and only a key with recipients:delete may clear it', async () => {
    const url = `http://localhost/api/v1/apps/${appA.key}/recipients/int-bob/contact?channel=email`
    const clear = (key: string) =>
      run(() =>
        clearContactData(new Request(url, { method: 'DELETE', headers: { authorization: `Bearer ${key}` } }), {
          appKey: appA.key,
          recipientKey: 'int-bob',
        }),
      )

    expect((await clear(keys.publisher)).code).toBe(ErrorCode.INSUFFICIENT_SCOPE.code)
    const cleared = await clear(keys.integration)
    expect(contactClearedSchema.parse(cleared.data)).toEqual({ channel: 'email', cleared: true })
    expect((await clear(keys.integration)).data).toEqual({ channel: 'email', cleared: false })
  })
})

describe('notifications and tokens', () => {
  test('deleting by key names the recipient and needs notifications:delete', async () => {
    const published = await publishNotification({
      app: { id: appA.id, key: appA.key, name: 'host A' },
      recipientKey: 'int-carol',
      type: 'verify',
      title: 'to delete',
      body: '',
      data: {},
      priority: 0,
      channels: ['inapp'],
    })

    const withoutRecipient = await run(() =>
      deleteNotificationData(
        new Request(`http://localhost/api/v1/apps/${appA.key}/notifications/${published.id}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${keys.janitor}` },
        }),
        { appKey: appA.key, id: published.id },
      ),
    )
    expect(withoutRecipient.code).toBe(ErrorCode.VALIDATION_ERROR.code)

    const publisherTry = await run(() =>
      deleteNotificationData(
        new Request(`http://localhost/api/v1/apps/${appA.key}/notifications/${published.id}?recipient=int-carol`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${keys.publisher}` },
        }),
        { appKey: appA.key, id: published.id },
      ),
    )
    expect(publisherTry.code).toBe(ErrorCode.INSUFFICIENT_SCOPE.code)

    const deleted = await run(() =>
      deleteNotificationData(
        new Request(`http://localhost/api/v1/apps/${appA.key}/notifications/${published.id}?recipient=int-carol`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${keys.janitor}` },
        }),
        { appKey: appA.key, id: published.id },
      ),
    )
    expect(deletedSchema.parse(deleted.data)).toEqual({ deleted: true })
  })

  test('minting a browser token needs tokens:create, not publish', async () => {
    const mint = (key: string) =>
      run(() => mintRecipientTokenData(request(key), { appKey: appA.key, recipientKey: 'int-alice' }))
    expect((await mint(keys.publisher)).code).toBe(ErrorCode.INSUFFICIENT_SCOPE.code)
    const minted = await mint(keys.tokens)
    expect(minted.data.token).toMatch(/^lrt_/)
    recipientTokenSchema.parse(minted.data)
  })

  test('a browser token cannot change a contact address; an app key can', async () => {
    const minted = await run(() =>
      mintRecipientTokenData(request(keys.tokens), { appKey: appA.key, recipientKey: 'int-alice' }),
    )
    const setContact = (auth: string) =>
      run(() =>
        setContactData(
          new Request(`http://localhost/api/v1/apps/${appA.key}/recipients/int-alice/contact`, {
            method: 'PUT',
            headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json' },
            body: JSON.stringify({ address: 'alice@example.test' }),
          }),
          { appKey: appA.key, recipientKey: 'int-alice' },
        ),
      )
    expect((await setContact(minted.data.token)).code).toBe(ErrorCode.FORBIDDEN.code)
    expect((await setContact(keys.integration)).data).toEqual({ channel: 'email', address: 'alice@example.test' })
  })
})

describe('apps:* on app-bound keys', () => {
  const json = { origin: 'http://localhost', 'content-type': 'application/json' }

  test('an app key sees and renames only its own app; an instance key sees all; no key creates an app', async () => {
    const own = await issue('apps-own', appA, ['apps:read', 'apps:update', 'apps:create'])
    const instance = await issueServiceKey({ userId, name: 'apps-instance', appKey: null, scopes: ['apps:read'] })
    issued.push({ id: instance.id, secret: instance.key })
    const listRequest = (key: string) =>
      new Request('http://localhost/api/v1/admin/apps', { headers: { authorization: `Bearer ${key}` } })

    const listed = await run(() => listAppsData(listRequest(own)))
    expect(listed.data.apps.map((app: { key: string }) => app.key)).toEqual([appA.key])

    const everyApp = await run(() => listAppsData(listRequest(instance.key)))
    expect(everyApp.data.apps.map((app: { key: string }) => app.key)).toEqual(
      expect.arrayContaining([appA.key, appB.key]),
    )

    const rename = (app: { key: string }) =>
      run(() =>
        updateAppData(
          new Request(`http://localhost/api/v1/admin/apps/${app.key}`, {
            method: 'PATCH',
            headers: { authorization: `Bearer ${own}`, ...json },
            body: JSON.stringify({ name: `own-${suffix}` }),
          }),
          { appKey: app.key },
        ),
      )
    expect((await rename(appB)).code).toBe(ErrorCode.INSUFFICIENT_SCOPE.code)
    expect((await rename(appA)).code).toBeUndefined()

    const created = await run(() =>
      createAppData(
        new Request('http://localhost/api/v1/admin/apps', {
          method: 'POST',
          headers: { authorization: `Bearer ${own}`, ...json },
          body: JSON.stringify({ name: `made-${suffix}`, origin: `https://made-${suffix}.test` }),
        }),
      ),
    )
    expect(created.code).toBe(ErrorCode.INSUFFICIENT_SCOPE.code)

    const creator = await issueServiceKey({ userId, name: 'apps-creator', appKey: null, scopes: ['apps:create'] })
    issued.push({ id: creator.id, secret: creator.key })
    const fromInstance = await run(() =>
      createAppData(
        new Request('http://localhost/api/v1/admin/apps', {
          method: 'POST',
          headers: { authorization: `Bearer ${creator.key}`, ...json },
          body: JSON.stringify({ name: `made-by-key-${suffix}`, origin: `https://made-by-key-${suffix}.test` }),
        }),
      ),
    )
    expect(fromInstance.code).toBe(ErrorCode.INSUFFICIENT_SCOPE.code)
  })
})

describe('in-app on the app page', () => {
  test('the channel list shows in-app as installed, and its switch saves per app', async () => {
    const reader = await issue('channels-reader', appA, ['apps:read', 'apps:update'])
    const bearer = { authorization: `Bearer ${reader}` }
    const inAppOf = async () => {
      const listed = await run(() =>
        getAppChannelsData(
          new Request(`http://localhost/api/v1/admin/apps/${appA.key}/channels`, { headers: bearer }),
          { appKey: appA.key },
        ),
      )
      return listed.data.channels.find((item: { channel: string }) => item.channel === 'inapp')
    }
    const setInApp = (enabled: boolean) =>
      run(() =>
        patchAppChannelData(
          new Request(`http://localhost/api/v1/admin/apps/${appA.key}/channels`, {
            method: 'PATCH',
            headers: { ...bearer, origin: 'http://localhost', 'content-type': 'application/json' },
            body: JSON.stringify({ channel: 'inapp', enabled }),
          }),
          { appKey: appA.key },
        ),
      )

    expect(await inAppOf()).toMatchObject({ installed: true, enabled: true })
    expect((await setInApp(false)).code).toBeUndefined()
    expect(await inAppOf()).toMatchObject({ enabled: false })
    await setInApp(true)
  })
})

describe('channel config on the channels switch route', () => {
  test('an app key or an instance key cannot set a webhook address here, so nothing is saved', async () => {
    const appKeyUpdater = await issue('config-updater-app', appA, ['apps:update'])
    const instanceUpdater = await issueServiceKey({
      userId,
      name: 'config-updater-instance',
      appKey: null,
      scopes: ['apps:update'],
    })
    issued.push({ id: instanceUpdater.id, secret: instanceUpdater.key })
    const attack = (key: string) =>
      run(() =>
        patchAppChannelData(
          new Request(`http://localhost/api/v1/admin/apps/${appA.key}/channels`, {
            method: 'PATCH',
            headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', origin: 'http://localhost' },
            body: JSON.stringify({ channel: 'webhook', config: { endpointUrl: 'https://attacker.example.test/hook' } }),
          }),
          { appKey: appA.key },
        ),
      )

    expect((await attack(appKeyUpdater)).code).toBe(ErrorCode.INSUFFICIENT_SCOPE.code)
    expect((await attack(instanceUpdater.key)).code).toBe(ErrorCode.INSUFFICIENT_SCOPE.code)
    const settings = await getAppChannelSettings(appA.id)
    expect(settings.webhook?.config.endpointUrl).not.toBe('https://attacker.example.test/hook')
  })
})
