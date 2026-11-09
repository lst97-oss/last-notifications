import { and, eq, lt } from 'drizzle-orm'

import { type BusinessDb, getBusinessDb } from '@/server/db/business-sql'
import { recipientTokens } from '@/server/db/schema'
import { RECIPIENT_TOKEN_TTL_MS } from '@/server/modules/notifications/domain/notification'
import { ensureRecipient } from '@/server/modules/notifications/infrastructure/notification-repository'

// Short-lived browser credential for one recipient: it reads that recipient's inbox, changes its read and archive
// state, its preferences and its push subscriptions. It cannot change a contact address. Only the sha256 hash is
// stored, so a database leak cannot be replayed as a live token.
export type MintedRecipientToken = { token: string; expiresAt: Date }

function hashToken(token: string): string {
  return new Bun.CryptoHasher('sha256').update(token).digest('hex')
}

export async function mintRecipientToken(
  input: { appId: string; recipientKey: string; now?: Date },
  db: BusinessDb = getBusinessDb(),
): Promise<MintedRecipientToken> {
  const token = `lrt_${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')}`
  const now = input.now ?? new Date()
  const expiresAt = new Date(now.getTime() + RECIPIENT_TOKEN_TTL_MS)
  await db.transaction(async (tx) => {
    await ensureRecipient(tx, input)
    await tx.insert(recipientTokens).values({
      appId: input.appId,
      recipientKey: input.recipientKey,
      tokenHash: hashToken(token),
      expiresAt,
    })
  })
  return { token, expiresAt }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function verifyRecipientToken(
  input: { token: string; appId: string; now?: Date },
  db: BusinessDb = getBusinessDb(),
): Promise<{ recipientKey: string; expiresAt: Date } | null> {
  if (!input.token.startsWith('lrt_')) return null
  // app_id is a uuid column; a non-uuid would make Postgres raise instead of
  // returning "no such token", so the shape is checked before the query.
  if (!UUID_PATTERN.test(input.appId)) return null
  const [row] = await db
    .select({ recipientKey: recipientTokens.recipientKey, expiresAt: recipientTokens.expiresAt })
    .from(recipientTokens)
    .where(and(eq(recipientTokens.tokenHash, hashToken(input.token)), eq(recipientTokens.appId, input.appId)))
    .limit(1)
  if (!row) return null
  if (row.expiresAt.getTime() <= (input.now ?? new Date()).getTime()) return null
  return { recipientKey: row.recipientKey, expiresAt: row.expiresAt }
}

export async function purgeExpiredRecipientTokens(
  db: BusinessDb = getBusinessDb(),
  now: Date = new Date(),
): Promise<number> {
  const removed = await db
    .delete(recipientTokens)
    .where(lt(recipientTokens.expiresAt, now))
    .returning({ tokenHash: recipientTokens.tokenHash })
  return removed.length
}
