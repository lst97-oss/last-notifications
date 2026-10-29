import { createHmac, timingSafeEqual } from 'node:crypto'

// One-click unsubscribe proof. It is not a session: it only lets the holder turn
// email off for one (app, recipient, address), so it never expires and is
// revocable by re-enabling the channel.
const LABEL = 'unsubscribe:v1'

function secret(): string {
  const value = typeof Bun !== 'undefined' ? Bun.env.BETTER_AUTH_SECRET : process.env.BETTER_AUTH_SECRET
  if (!value) throw new Error('BETTER_AUTH_SECRET is required for unsubscribe tokens')
  return value
}

export function createUnsubscribeToken(appId: string, recipientKey: string, email: string): string {
  return createHmac('sha256', secret()).update(`${LABEL}:${appId}:${recipientKey}:${email}`).digest('base64url')
}

export function verifyUnsubscribeToken(
  input: { appId: string; recipientKey: string; email: string; token: string },
  expectedSecret?: string,
): boolean {
  const key = expectedSecret ?? secret()
  const expected = createHmac('sha256', key)
    .update(`${LABEL}:${input.appId}:${input.recipientKey}:${input.email}`)
    .digest()
  let provided: Buffer
  try {
    provided = Buffer.from(input.token, 'base64url')
  } catch {
    return false
  }
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}
