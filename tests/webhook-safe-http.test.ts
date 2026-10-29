import { describe, expect, test } from 'bun:test'

import { postWebhook } from '@/server/plugins/webhook/safe-http'

// A local receiver stands in for a webhook endpoint. Its port is ephemeral.
const receiver = Bun.serve({
  port: 0,
  hostname: '127.0.0.1',
  fetch(request) {
    if (new URL(request.url).pathname === '/redirect') {
      return new Response(null, { status: 302, headers: { location: '/elsewhere' } })
    }
    return new Response('ok', { status: 200 })
  },
})
const port = receiver.port

const options = (allowPrivate: boolean) => ({
  headers: { 'x-test': '1' },
  timeoutMs: 5_000,
  signal: new AbortController().signal,
  allowPrivate,
})

describe('postWebhook', () => {
  test('refuses a hostname that resolves to loopback at connect time', async () => {
    const attempt = postWebhook(`http://localhost:${port}/hook`, '{}', options(false))
    await expect(attempt).rejects.toMatchObject({ code: 'WEBHOOK_URL_BLOCKED' })
  })

  test('delivers to a local receiver when private networks are allowed', async () => {
    const { status } = await postWebhook(`http://localhost:${port}/hook`, '{}', options(true))
    expect(status).toBe(200)
  })

  test('never follows a redirect', async () => {
    const { status } = await postWebhook(`http://localhost:${port}/redirect`, '{}', options(true))
    expect(status).toBe(302)
  })
})

describe('postWebhook literal addresses', () => {
  test('refuses a private IP literal before connecting when private networks are off', async () => {
    await expect(postWebhook(`http://127.0.0.1:${port}/hook`, '{}', options(false))).rejects.toMatchObject({
      code: 'WEBHOOK_URL_BLOCKED',
    })
    await expect(postWebhook(`http://[::1]:${port}/hook`, '{}', options(false))).rejects.toMatchObject({
      code: 'WEBHOOK_URL_BLOCKED',
    })
  })
})
