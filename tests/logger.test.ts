import { describe, expect, test } from 'bun:test'

import { createLogger, getRequestLogger, type Logger } from '@/server/observability/logger'

function recordingSink(calls: Array<{ level: string; message: string; fields?: Record<string, unknown> }>): Logger {
  const make = (extra: Record<string, unknown>): Logger => ({
    debug: (message, fields) => calls.push({ level: 'debug', message, fields: { ...extra, ...fields } }),
    info: (message, fields) => calls.push({ level: 'info', message, fields: { ...extra, ...fields } }),
    warn: (message, fields) => calls.push({ level: 'warn', message, fields: { ...extra, ...fields } }),
    error: (message, fields) => calls.push({ level: 'error', message, fields: { ...extra, ...fields } }),
    child: (fields) => make({ ...extra, ...fields }),
  })
  return make({})
}

describe('createLogger', () => {
  test('forwards message and merged fields to sink', () => {
    const calls: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = []
    const logger = createLogger({ sink: recordingSink(calls), baseFields: { service: 'api' } })
    logger.info('hello', { requestId: 'r1' })
    expect(calls).toEqual([{ level: 'info', message: 'hello', fields: { service: 'api', requestId: 'r1' } }])
  })

  test('child fields merge with child winning', () => {
    const calls: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = []
    const logger = createLogger({ sink: recordingSink(calls), baseFields: { service: 'api' } })
    const child = logger.child({ requestId: 'r1' }).child({ requestId: 'r2', extra: 1 })
    child.warn('slow', { latencyMs: 9 })
    expect(calls).toEqual([
      { level: 'warn', message: 'slow', fields: { service: 'api', requestId: 'r2', extra: 1, latencyMs: 9 } },
    ])
  })
})

describe('getRequestLogger', () => {
  test('returns the same instance across calls', () => {
    expect(getRequestLogger()).toBe(getRequestLogger())
  })
})
