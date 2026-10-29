import { describe, expect, test } from 'bun:test'

import { createUnsubscribeToken, verifyUnsubscribeToken } from '@/server/modules/notifications/domain/unsubscribe-token'
import { emailConfigDef, getEmailConfig } from '@/server/plugins/email/email.config'
import { createEmailChannel } from '@/server/plugins/email/email.plugin'
import { parseEmailStyle } from '@/server/plugins/email/email.style'
import { renderDefaultTheme } from '@/server/plugins/email/themes/default'
import { loadPluginConfig } from '@/server/plugins/plugin-config'

process.env.BETTER_AUTH_SECRET ??= 'test-secret-0123456789abcdef0123456789abcdef'

describe('renderDefaultTheme', () => {
  test('escapes user-controlled content', () => {
    const { html, text } = renderDefaultTheme(
      { appName: 'App', title: '<script>alert(1)</script>', body: 'a & b' },
      { theme: 'default' },
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('a &amp; b')
    expect(text).toContain('<script>alert(1)</script>')
  })

  test('splits paragraphs on blank lines', () => {
    const { html } = renderDefaultTheme({ appName: 'App', title: 'T', body: 'one\n\ntwo' }, { theme: 'default' })
    expect(html.match(/<p style="margin:0 0 16px">/g)?.length).toBe(2)
  })

  test('renders the action link only when given a url', () => {
    const without = renderDefaultTheme({ appName: 'App', title: 'T', body: 'b' }, { theme: 'default' })
    expect(without.html).not.toContain('href=')
    const withUrl = renderDefaultTheme(
      { appName: 'App', title: 'T', body: 'b', actionUrl: 'https://example.com/x' },
      { theme: 'default' },
    )
    expect(withUrl.html).toContain('href="https://example.com/x"')
  })

  test('uses the accent colour from the style', () => {
    const { html } = renderDefaultTheme(
      { appName: 'App', title: 'T', body: 'b', actionUrl: 'https://e.test' },
      { theme: 'default', accentColor: '#ff0000' },
    )
    expect(html).toContain('background:#ff0000')
  })
})

describe('parseEmailStyle', () => {
  test('falls back to the default theme for junk', () => {
    expect(parseEmailStyle({ email: { theme: 'nope', accentColor: 'red' } })).toEqual({ theme: 'default' })
    expect(parseEmailStyle({})).toEqual({ theme: 'default' })
  })

  test('keeps a valid accent colour', () => {
    expect(parseEmailStyle({ email: { accentColor: '#00ff00' } })).toEqual({
      theme: 'default',
      accentColor: '#00ff00',
    })
  })
})

describe('unsubscribe token', () => {
  const input = { appId: 'app-1', recipientKey: 'user-1', email: 'user@example.com' }

  test('verifies a token it produced', () => {
    const token = createUnsubscribeToken(input.appId, input.recipientKey, input.email)
    expect(verifyUnsubscribeToken({ ...input, token })).toBe(true)
  })

  test('rejects a different recipient, address, or app', () => {
    const token = createUnsubscribeToken(input.appId, input.recipientKey, input.email)
    expect(verifyUnsubscribeToken({ ...input, recipientKey: 'user-2', token })).toBe(false)
    expect(verifyUnsubscribeToken({ ...input, email: 'other@example.com', token })).toBe(false)
    expect(verifyUnsubscribeToken({ ...input, appId: 'app-2', token })).toBe(false)
  })

  test('rejects a token signed with another secret', () => {
    const token = createUnsubscribeToken(input.appId, input.recipientKey, input.email)
    expect(verifyUnsubscribeToken({ ...input, token }, 'a-different-secret-0123456789abcdef')).toBe(false)
  })

  test('rejects garbage without throwing', () => {
    expect(verifyUnsubscribeToken({ ...input, token: 'not-a-token' })).toBe(false)
  })
})

describe('email channel status', () => {
  test('reports config facts by presence, never the secret itself', () => {
    const config = {
      ...getEmailConfig({ provider: 'gmail', user: 'sender@gmail.com' }),
      pass: 'super-secret-app-password',
    }
    const status = createEmailChannel({ config }).describe()

    expect(status.facts).toContainEqual({ label: 'Provider', value: 'gmail' })
    expect(status.facts).toContainEqual({ label: 'Credentials', value: 'SMTP_PASS set' })
    expect(JSON.stringify(status)).not.toContain('super-secret-app-password')
  })
})

describe('getEmailConfig providers', () => {
  const resolve = (file: Record<string, unknown>, env: Record<string, string | undefined> = {}) =>
    loadPluginConfig(emailConfigDef, { file, env })

  test('ships unconfigured on gmail defaults', () => {
    expect(getEmailConfig({})).toMatchObject({
      provider: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      configured: false,
      configError: null,
    })
  })

  test('gmail is configured by user in the file and SMTP_PASS in the environment', () => {
    const config = resolve({ provider: 'gmail', user: 'sender@gmail.com' }, { SMTP_PASS: 'app-password' })
    expect(config).toMatchObject({ configured: true, host: 'smtp.gmail.com', port: 465, secure: true })
    expect(config.from).toBe('sender@gmail.com')
    expect(config.replyTo).toBe('sender@gmail.com')
  })

  test('an explicit from overrides the user while the user still authenticates', () => {
    const config = resolve(
      { provider: 'gmail', user: 'sender@gmail.com', from: 'notifications@example.com' },
      { SMTP_PASS: 'app-password' },
    )
    expect(config.user).toBe('sender@gmail.com')
    expect(config.from).toBe('notifications@example.com')
    expect(config.replyTo).toBe('notifications@example.com')
  })

  test('microsoft365 is a preset over STARTTLS', () => {
    const config = resolve({ provider: 'microsoft365', user: 'sender@contoso.com' }, { SMTP_PASS: 'password' })
    expect(config).toMatchObject({
      provider: 'microsoft365',
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      configured: true,
    })
  })

  test('custom takes its endpoint from the file and allows no auth', () => {
    const config = resolve({
      provider: 'custom',
      from: 'notifications@example.com',
      custom: { host: '127.0.0.1', port: 1025 },
    })
    expect(config).toMatchObject({ provider: 'custom', host: '127.0.0.1', port: 1025, secure: false, configured: true })
  })

  test('custom without an endpoint reports a config error', () => {
    const config = resolve({ provider: 'custom', from: 'notifications@example.com' })
    expect(config.configured).toBe(false)
    expect(config.configError).toBe(
      'Provider "custom" needs a custom: { host, port, secure } block in src/server/plugins/email/email.config.ts',
    )
  })

  test('presets require the password', () => {
    expect(resolve({ provider: 'gmail', user: 'sender@gmail.com' }).configured).toBe(false)
  })
})
