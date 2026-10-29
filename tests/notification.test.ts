import { describe, expect, test } from 'bun:test'

import { decodeCursor, encodeCursor, resolveTargetChannels } from '@/server/modules/notifications/domain/notification'

describe('resolveTargetChannels', () => {
  test('defaults to every channel when none is requested', () => {
    expect(resolveTargetChannels({})).toEqual(['inapp', 'email', 'webpush'])
  })

  test('webhook is opt-in: a publish that names no channels never targets it', () => {
    expect(resolveTargetChannels({})).not.toContain('webhook')
  })

  test('webhook is delivered when a publish names it', () => {
    expect(resolveTargetChannels({ requested: ['webhook', 'inapp'] })).toEqual(['inapp', 'webhook'])
  })

  test('honours the requested subset and keeps the canonical order', () => {
    expect(resolveTargetChannels({ requested: ['webpush', 'inapp'] })).toEqual(['inapp', 'webpush'])
  })

  test('drops a channel the app switched off', () => {
    expect(
      resolveTargetChannels({ requested: ['inapp', 'email'], appChannels: { email: { enabled: false } } }),
    ).toEqual(['inapp'])
  })

  test('drops a channel the recipient opted out of', () => {
    expect(resolveTargetChannels({ requested: ['inapp', 'email'], preferences: { email: false } })).toEqual(['inapp'])
  })

  test('an opt-in preference keeps the channel', () => {
    expect(resolveTargetChannels({ requested: ['email'], preferences: { email: true } })).toEqual(['email'])
  })

  test('ignores unknown requested channels', () => {
    expect(resolveTargetChannels({ requested: ['sms'] })).toEqual([])
  })
})

describe('inbox cursor', () => {
  test('round-trips the timestamp and id', () => {
    const cursor = { t: '2026-10-28T07:48:41.443Z', i: '2f1c4cab-4d80-433c-84ac-c116bbdff567' }
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor)
  })

  test('rejects a value that is not a cursor', () => {
    expect(() => decodeCursor('garbage')).toThrow()
  })

  test('rejects a cursor with an unparseable timestamp', () => {
    const invalid = Buffer.from(JSON.stringify({ t: 'not-a-date', i: 'x' }), 'utf8').toString('base64url')
    expect(() => decodeCursor(invalid)).toThrow()
  })
})
