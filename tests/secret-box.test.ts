import { describe, expect, test } from 'bun:test'
import { randomBytes } from 'node:crypto'

import { newSigningSecret, openSecret, SecretBoxError, sealSecret } from '@/server/security/secret-box'

const keyEnv = (key = randomBytes(32).toString('base64')) => ({ SECRET_ENCRYPTION_KEY: key })

describe('secret box', () => {
  test('a sealed secret opens back to the original', () => {
    const env = keyEnv()
    expect(openSecret(sealSecret('whsec-plain-0123456789', env), env)).toBe('whsec-plain-0123456789')
  })

  test('the sealed form never contains the plaintext', () => {
    const env = keyEnv()
    const sealed = sealSecret('whsec-plain-0123456789', env)
    expect(sealed.startsWith('v1.')).toBe(true)
    expect(sealed).not.toContain('whsec-plain')
  })

  test('the same secret sealed twice differs, because each seal has its own IV', () => {
    const env = keyEnv()
    expect(sealSecret('same', env)).not.toBe(sealSecret('same', env))
  })

  test('a tampered ciphertext is refused', () => {
    const env = keyEnv()
    const [version, iv, tag, ciphertext] = sealSecret('whsec-plain-0123456789', env).split('.')
    const flipped = Buffer.from(ciphertext ?? '', 'base64url')
    flipped[0] = (flipped[0] ?? 0) ^ 0xff
    const tampered = [version, iv, tag, flipped.toString('base64url')].join('.')
    expect(() => openSecret(tampered, env)).toThrow(SecretBoxError)
  })

  test('a different master key cannot open the secret', () => {
    const sealed = sealSecret('whsec-plain-0123456789', keyEnv())
    expect(() => openSecret(sealed, keyEnv())).toThrow(SecretBoxError)
  })

  test('sealing without the key fails loudly and names the variable', () => {
    expect(() => sealSecret('x', {})).toThrow('SECRET_ENCRYPTION_KEY is not set')
  })

  test('a key that does not decode to 32 bytes is refused', () => {
    expect(() => sealSecret('x', keyEnv(randomBytes(16).toString('base64')))).toThrow(
      'SECRET_ENCRYPTION_KEY must decode to 32 bytes',
    )
  })

  test('an unknown sealed format is refused', () => {
    expect(() => openSecret('not-a-sealed-value', keyEnv())).toThrow(SecretBoxError)
  })

  test('a new signing secret is 32 random bytes, hex encoded, and never repeats', () => {
    const first = newSigningSecret()
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(newSigningSecret()).not.toBe(first)
  })
})
