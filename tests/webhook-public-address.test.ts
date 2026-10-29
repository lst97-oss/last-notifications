import { describe, expect, test } from 'bun:test'

import { isPublicAddress } from '@/server/modules/notifications/domain/public-address'
import { webhookUrlProblem } from '@/server/modules/notifications/domain/webhook-url'

describe('isPublicAddress', () => {
  test.each([
    ['93.184.216.34', true],
    ['8.8.8.8', true],
    ['127.0.0.1', false],
    ['10.1.2.3', false],
    ['172.16.0.1', false],
    ['172.32.0.1', true],
    ['192.168.1.1', false],
    ['169.254.169.254', false],
    ['100.64.0.1', false],
    ['0.0.0.0', false],
    ['224.0.0.1', false],
    ['::1', false],
    ['::', false],
    ['fc00::1', false],
    ['fe80::1', false],
    ['ff02::1', false],
    ['2606:4700:4700::1111', true],
    ['::ffff:127.0.0.1', false],
    ['::ffff:7f00:1', false],
    ['::ffff:8.8.8.8', true],
    ['64:ff9b::7f00:1', false],
    ['not-an-ip', false],
  ])('%s is public: %p', (address, expected) => {
    expect(isPublicAddress(address)).toBe(expected)
  })
})

describe('webhookUrlProblem', () => {
  const strict = { allowPrivate: false }

  test('accepts an https URL to a public host', () => {
    expect(webhookUrlProblem('https://hooks.example.com/notify', strict)).toBeNull()
  })

  test('requires https unless the development switch is on', () => {
    expect(webhookUrlProblem('http://hooks.example.com/notify', strict)).toBe('must use https')
    expect(webhookUrlProblem('http://localhost:4000/hook', { allowPrivate: true })).toBeNull()
  })

  test('refuses private and loopback literals and localhost names', () => {
    expect(webhookUrlProblem('https://127.0.0.1/hook', strict)).toBe('must not point at a private network')
    expect(webhookUrlProblem('https://169.254.169.254/latest', strict)).toBe('must not point at a private network')
    expect(webhookUrlProblem('https://[::1]/hook', strict)).toBe('must not point at a private network')
    expect(webhookUrlProblem('https://localhost/hook', strict)).toBe('must not point at a private network')
  })

  test('refuses credentials, garbage, and over-long URLs', () => {
    expect(webhookUrlProblem('https://user:pass@hooks.example.com/', strict)).toBe('must not contain credentials')
    expect(webhookUrlProblem('not a url', strict)).toBe('must be a valid URL')
    expect(webhookUrlProblem(`https://a.example/${'x'.repeat(2050)}`, strict)).toContain('at most 2048')
  })
})
