import { and, eq } from 'drizzle-orm'

import { type BusinessDb, getBusinessDb } from '@/server/db/business-sql'
import { pushSubscriptions } from '@/server/db/schema'
import { ensureRecipient } from '@/server/modules/notifications/infrastructure/notification-repository'

export type PushSubscriptionInput = {
  appId: string
  recipientKey: string
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string | null
}

// The endpoint is unique per app: re-subscribing the same endpoint refreshes its keys and revives
// it after a previous 404/410. It cannot move a row into another app.
export async function upsertPushSubscription(
  input: PushSubscriptionInput,
  db: BusinessDb = getBusinessDb(),
): Promise<void> {
  await db.transaction(async (tx) => {
    await ensureRecipient(tx, input)
    await tx
      .insert(pushSubscriptions)
      .values({
        appId: input.appId,
        recipientKey: input.recipientKey,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
      })
      .onConflictDoUpdate({
        target: [pushSubscriptions.appId, pushSubscriptions.endpoint],
        set: {
          recipientKey: input.recipientKey,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent ?? null,
          failedAt: null,
          failureCount: 0,
        },
      })
  })
}

export async function deletePushSubscription(
  input: { appId: string; recipientKey: string; endpoint: string },
  db: BusinessDb = getBusinessDb(),
): Promise<boolean> {
  const removed = await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.appId, input.appId),
        eq(pushSubscriptions.recipientKey, input.recipientKey),
        eq(pushSubscriptions.endpoint, input.endpoint),
      ),
    )
    .returning({ id: pushSubscriptions.id })
  return removed.length > 0
}
