import { describe, expect, test } from 'bun:test'

import { ErrorCode, HttpError } from '@/server/http/errors'
import { withAuth, withContext } from '@/server/http/with-context'
import { type Logger } from '@/server/observability/logger'

function recordingLogger(calls: Array<{ level: string; message: string; fields?: Record<string, unknown> }>): Logger {
  const make = (extra: Record<string, unknown>): Logger => ({
    debug: (message, fields) => calls.push({ level: 'debug', message, fields: { ...extra, ...fields } }),
    info: (message, fields) => calls.push({ level: 'info', message, fields: { ...extra, ...fields } }),
    warn: (message, fields) => calls.push({ level: 'warn', message, fields: { ...extra, ...fields } }),
    error: (message, fields) => calls.push({ level: 'error', message, fields: { ...extra, ...fields } }),
    child: (fields) => make({ ...extra, ...fields }),
  })
  return make({})
}

function request(id?: string): { request: Request } {
  const headers: Record<string, string> = id ? { 'x-request-id': id } : {}
  return { request: new Request('http://localhost/api/ready', { headers }) }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('withContext', () => {
  test('echoes inbound id and wraps result in data envelope', async () => {
    const calls: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = []
    const handler = withContext(async (ctx) => ({ id: ctx.requestId }), { logger: recordingLogger(calls) })
    const res = await handler(request('probe-1'))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-request-id')).toBe('probe-1')
    expect(await res.json()).toEqual({ data: { id: 'probe-1' } })
    const start = calls.find((c) => c.message === 'request.start')
    const complete = calls.find((c) => c.message === 'request.complete')
    expect(start?.fields).toMatchObject({ requestId: 'probe-1', method: 'GET', path: '/api/ready' })
    expect(complete?.fields).toMatchObject({ requestId: 'probe-1', status: 200 })
    expect(typeof complete?.fields?.latencyMs).toBe('number')
  })

  test('generates uuid when header absent', async () => {
    const calls: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = []
    const handler = withContext(async (ctx) => ({ id: ctx.requestId }), { logger: recordingLogger(calls) })
    const res = await handler(request())
    const echoed = res.headers.get('x-request-id')
    expect(echoed).toMatch(uuidPattern)
    expect(await res.json()).toEqual({ data: { id: echoed } })
  })

  test('handler throw maps to fail status with echoed id', async () => {
    const calls: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = []
    const handler = withContext(
      async () => {
        throw new HttpError(ErrorCode.BAD_REQUEST, 'bad input')
      },
      { logger: recordingLogger(calls) },
    )
    const res = await handler(request('probe-9'))
    expect(res.status).toBe(400)
    expect(res.headers.get('x-request-id')).toBe('probe-9')
    expect(await res.json()).toEqual({ error: { code: 'BAD_REQUEST', message: 'bad input' } })
    expect(calls.find((c) => c.message === 'request.error')?.fields).toMatchObject({
      requestId: 'probe-9',
      code: 'BAD_REQUEST',
      status: 400,
    })
  })
})

describe('withAuth', () => {
  test('stub returns 501 without invoking handler', async () => {
    let invoked = false
    const handler = withAuth(async () => {
      invoked = true
      return {}
    })
    const res = await handler(request())
    expect(res.status).toBe(501)
    expect(invoked).toBe(false)
    expect(await res.json()).toEqual({
      error: { code: 'NOT_IMPLEMENTED', message: 'Authentication is not wired yet' },
    })
  })
})
