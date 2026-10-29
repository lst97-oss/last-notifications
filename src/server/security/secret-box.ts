import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// Seals per-app secrets (webhook signing keys) at rest with AES-256-GCM. The master key is
// SECRET_ENCRYPTION_KEY, base64 of 32 random bytes. It is read when a secret is sealed or opened,
// so the app boots without it and only the features that need it refuse to run.
const FORMAT = 'v1'
const IV_BYTES = 12
const KEY_BYTES = 32

export class SecretBoxError extends Error {}

type Env = Record<string, string | undefined>

function masterKey(env: Env = typeof Bun !== 'undefined' ? Bun.env : process.env): Buffer {
  const raw = env.SECRET_ENCRYPTION_KEY?.trim()
  if (!raw) throw new SecretBoxError('SECRET_ENCRYPTION_KEY is not set')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== KEY_BYTES) throw new SecretBoxError('SECRET_ENCRYPTION_KEY must decode to 32 bytes')
  return key
}

// A fresh signing secret: 32 random bytes, hex encoded. Shown to the host once, then only sealed.
export function newSigningSecret(): string {
  return randomBytes(KEY_BYTES).toString('hex')
}

// Format `v1.<iv>.<tag>.<ciphertext>`, all base64url. The version prefix leaves room to rotate the scheme.
export function sealSecret(plaintext: string, env?: Env): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', masterKey(env), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [
    FORMAT,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

// Throws SecretBoxError for a malformed value, a wrong master key, or any tampering (GCM authenticates).
export function openSecret(sealed: string, env?: Env): string {
  const [version, iv, tag, ciphertext] = sealed.split('.')
  if (version !== FORMAT || !iv || !tag || !ciphertext) throw new SecretBoxError('Sealed secret has an unknown format')
  const decipher = createDecipheriv('aes-256-gcm', masterKey(env), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  try {
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    throw new SecretBoxError('Sealed secret failed authentication')
  }
}
