import { describe, expect, test } from 'bun:test'

import { unsubscribeConfirmPage, unsubscribedPage } from '@/server/modules/notifications/http/unsubscribe-page'

describe('unsubscribe pages', () => {
  test('the confirmation page asks first and posts back to the same URL', async () => {
    const response = unsubscribeConfirmPage({ appName: 'Shop', email: 'reader@example.com' })
    const html = await response.text()
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(html).toContain('<form method="post">')
    expect(html).not.toContain('You are unsubscribed')
  })

  test('values from the link are escaped before they reach the markup', async () => {
    const html = await unsubscribeConfirmPage({ appName: '<script>x</script>', email: '"a"@x.test' }).text()
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;')
    expect(html).toContain('&quot;a&quot;@x.test')
  })

  test('the done page says the email is off', async () => {
    const html = await unsubscribedPage({ appName: 'Shop' }).text()
    expect(html).toContain('You are unsubscribed')
  })
})
