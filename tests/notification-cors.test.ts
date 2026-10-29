import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { closeBusinessSql } from '@/server/db/business-sql'
import { createApp, deleteApp } from '@/server/modules/apps/infrastructure/app-repository'
import { notificationPreflight, withNotificationCors } from '@/server/modules/notifications/http/notification-cors'

const ORIGIN = 'https://notification-cors.test'
let appKey = ''

beforeAll(async () => {
  appKey = (await createApp(null, { name: 'notification-cors', origin: ORIGIN })).key
})

afterAll(async () => {
  if (appKey) await deleteApp(appKey)
  await closeBusinessSql()
})

describe('notification CORS', () => {
  test('echoes a registered origin and allows credentials', async () => {
    const response = await withNotificationCors(
      new Request('http://localhost/x', { headers: { origin: ORIGIN } }),
      appKey,
      'GET, OPTIONS',
      async () => new Response('ok'),
    )
    expect(response.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
  })

  test('leaves server-to-server calls alone', async () => {
    const response = await withNotificationCors(
      new Request('http://localhost/x'),
      appKey,
      'GET',
      async () => new Response('ok'),
    )
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  test('refuses an unregistered origin', async () => {
    const response = await withNotificationCors(
      new Request('http://localhost/x', { headers: { origin: 'https://evil.test' } }),
      appKey,
      'GET',
      async () => new Response('ok'),
    )
    expect(response.status).toBe(403)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  test('answers preflight for a registered origin', async () => {
    const response = await notificationPreflight(
      new Request('http://localhost/x', { headers: { origin: ORIGIN } }),
      appKey,
      'GET, OPTIONS',
    )
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS')
    expect(response.headers.get('access-control-allow-headers')).toContain('authorization')
    expect(response.headers.get('access-control-max-age')).toBe('600')
  })

  test('an unknown app is not treated as an origin failure', async () => {
    const response = await withNotificationCors(
      new Request('http://localhost/x', { headers: { origin: ORIGIN } }),
      'missing-app',
      'GET',
      async () => new Response('ok'),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })
})
