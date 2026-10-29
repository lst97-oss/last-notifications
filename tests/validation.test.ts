import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { HttpStatus } from '@lst97-oss/last-httprism'

import { HttpError } from '@/server/http/errors'
import { parseJsonBody, parsePaginationParams, parseSearchParams, parseWith } from '@/server/http/validation'

const schema = z.object({ name: z.string().min(1), age: z.number().int().nonnegative() })

describe('parseWith', () => {
  test('returns the parsed value for valid input', () => {
    expect(parseWith(schema, { name: 'ada', age: 36 })).toEqual({ name: 'ada', age: 36 })
  })

  test('throws 400 VALIDATION_ERROR with path-qualified messages', () => {
    try {
      parseWith(schema, { name: '', age: -1 })
      throw new Error('did not throw')
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError)
      const http = error as HttpError
      expect(http.status).toBe(400)
      expect(http.code).toBe('VALIDATION_ERROR')
      expect(http.expose).toBe(true)
      expect(http.message).toContain('name:')
      expect(http.message).toContain('age:')
    }
  })

  test('missing fields name the absent path', () => {
    try {
      parseWith(schema, {})
      throw new Error('did not throw')
    } catch (error) {
      expect((error as HttpError).status).toBe(400)
      expect((error as HttpError).message).toContain('name:')
    }
  })
})

describe('parseJsonBody', () => {
  test('parses a valid JSON body', async () => {
    const req = new Request('http://localhost/api/x', {
      method: 'POST',
      body: JSON.stringify({ name: 'ada', age: 36 }),
    })
    expect(await parseJsonBody(req, schema)).toEqual({ name: 'ada', age: 36 })
  })

  test('malformed JSON is 400 MALFORMED_JSON', async () => {
    const req = new Request('http://localhost/api/x', { method: 'POST', body: 'not-json{' })
    try {
      await parseJsonBody(req, schema)
      throw new Error('did not throw')
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError)
      expect((error as HttpError).status).toBe(400)
      expect((error as HttpError).code).toBe('MALFORMED_JSON')
    }
  })

  test('schema failure is 400 VALIDATION_ERROR', async () => {
    const req = new Request('http://localhost/api/x', { method: 'POST', body: JSON.stringify({ name: '' }) })
    try {
      await parseJsonBody(req, schema)
      throw new Error('did not throw')
    } catch (error) {
      expect((error as HttpError).code).toBe('VALIDATION_ERROR')
    }
  })
})

describe('parseSearchParams', () => {
  const paging = z.object({ page: z.coerce.number().int().min(1).default(1), q: z.string().optional() })

  test('coerces query strings to typed values', () => {
    expect(parseSearchParams('http://localhost/api/x?page=3&q=hi', paging)).toEqual({ page: 3, q: 'hi' })
  })

  test('defaults apply when params are absent', () => {
    expect(parseSearchParams('http://localhost/api/x', paging)).toEqual({ page: 1 })
  })

  test('invalid values are 400 VALIDATION_ERROR', () => {
    try {
      parseSearchParams('http://localhost/api/x?page=zero', paging)
      throw new Error('did not throw')
    } catch (error) {
      expect((error as HttpError).status).toBe(400)
      expect((error as HttpError).code).toBe('VALIDATION_ERROR')
    }
  })
})

describe('parsePaginationParams', () => {
  test('defaults limit 20 offset 0 when params are absent', () => {
    expect(parsePaginationParams('http://localhost/api/x')).toEqual({ limit: 20, offset: 0 })
  })

  test('parses explicit values', () => {
    expect(parsePaginationParams('http://localhost/api/x?limit=10&offset=40')).toEqual({ limit: 10, offset: 40 })
  })

  test('limit over 100 is 400, not silent clamping', () => {
    try {
      parsePaginationParams('http://localhost/api/x?limit=1000')
      throw new Error('did not throw')
    } catch (error) {
      expect((error as HttpError).status).toBe(400)
      expect((error as HttpError).code).toBe('VALIDATION_ERROR')
      expect((error as HttpError).message).toContain('limit:')
    }
  })

  test('negative offset is 400', () => {
    try {
      parsePaginationParams('http://localhost/api/x?offset=-5')
      throw new Error('did not throw')
    } catch (error) {
      expect((error as HttpError).status).toBe(400)
    }
  })
})

describe('parseJsonBody size cap', () => {
  const post = (text: string, headers: Record<string, string> = {}) =>
    new Request('https://api.test/inbox', {
      method: 'POST',
      body: text,
      headers: { 'content-type': 'application/json', ...headers },
    })

  test('parses a body within the cap', async () => {
    expect(await parseJsonBody(post('{"name":"ada","age":36}'), schema, 1024)).toEqual({ name: 'ada', age: 36 })
  })

  test('refuses a declared Content-Length over the cap with 413', async () => {
    const attempt = parseJsonBody(post('{"name":"ada","age":36}', { 'content-length': '999999' }), schema, 1024)
    await expect(attempt).rejects.toMatchObject({ status: HttpStatus.CONTENT_TOO_LARGE.code, code: 'BODY_TOO_LARGE' })
  })

  test('stops a chunked body (no Content-Length) once it passes the cap', async () => {
    const chunk = new TextEncoder().encode('x'.repeat(600))
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk)
        controller.enqueue(chunk)
        controller.close()
      },
    })
    const request = new Request('https://api.test/inbox', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit)
    await expect(parseJsonBody(request, schema, 1000)).rejects.toMatchObject({ code: 'BODY_TOO_LARGE' })
  })

  test('malformed JSON stays a 400 MALFORMED_JSON', async () => {
    await expect(parseJsonBody(post('{not json'), schema, 1024)).rejects.toMatchObject({ code: 'MALFORMED_JSON' })
  })
})
