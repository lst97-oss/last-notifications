import { describe, expect, test } from 'bun:test'

import { ErrorCode, HttpError } from '@/server/http/errors'
import { fail, ok } from '@/server/http/response'

describe('ok', () => {
  test('wraps data with 200 and no-store', async () => {
    const res = ok({ status: 'ok' })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ data: { status: 'ok' } })
  })

  test('explicit status and caller cache-control wins', async () => {
    const res = ok({ status: 'degraded' }, { status: 503, headers: { 'cache-control': 'max-age=60' } })
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('max-age=60')
    expect(await res.json()).toEqual({ data: { status: 'degraded' } })
  })
})

describe('fail', () => {
  test('HttpError 400 exposes message', async () => {
    const res = fail(new HttpError(ErrorCode.BAD_REQUEST, 'bad input'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: { code: 'BAD_REQUEST', message: 'bad input' } })
  })

  test('plain Error maps to 500 generic message', async () => {
    const res = fail(new Error('db password=secret'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } })
  })
})
