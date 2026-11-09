import { describe, expect, test } from 'bun:test'

import { isPushServiceEndpoint } from '@/server/modules/notifications/domain/push-endpoint'

describe('push endpoints', () => {
  test('the browser push services are accepted over https', () => {
    expect(isPushServiceEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true)
    expect(isPushServiceEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true)
    expect(isPushServiceEndpoint('https://web.push.apple.com/abc')).toBe(true)
    expect(isPushServiceEndpoint('https://wns2-pn1p.notify.windows.com/w/?token=abc')).toBe(true)
  })

  test('any other host is refused, including internal addresses and look-alike names', () => {
    for (const endpoint of [
      'https://10.0.0.5:8443/push',
      'https://169.254.169.254/latest/meta-data',
      'https://localhost/push',
      'https://internal.corp.example/push',
      'https://fcm.googleapis.com.attacker.example/push',
      'https://attacker.example/fcm.googleapis.com',
      'https://notify.windows.com.evil.example/push',
    ]) {
      expect(isPushServiceEndpoint(endpoint)).toBe(false)
    }
  })

  test('plain http, embedded credentials and non-URLs are refused', () => {
    expect(isPushServiceEndpoint('http://fcm.googleapis.com/fcm/send/abc')).toBe(false)
    expect(isPushServiceEndpoint('https://user:pass@fcm.googleapis.com/x')).toBe(false)
    expect(isPushServiceEndpoint('not a url')).toBe(false)
  })
})
