import { and, asc, eq, gt, sql } from 'drizzle-orm'

import { type BusinessDb, getBusinessDb } from '@/server/db/business-sql'
import { pushSubscriptions, recipientContacts, recipients } from '@/server/db/schema'
import type { ContactChannelKind } from '@/server/db/vocabularies'
import { maskEmail, maskWebhookUrl } from '@/server/modules/notifications/domain/masking'
import { getChannelPreferences } from '@/server/modules/notifications/infrastructure/notification-repository'

export type RecipientSummary = {
  recipientKey: string
  email: { set: boolean; masked: string | null }
  webhook: { set: boolean; masked: string | null }
  push: { subscriptions: number }
  preferences: Record<string, boolean>
}

// The masked view of one recipient: contacts, preferences and push subscription count.
export async function getRecipientSummary(
  input: { appId: string; recipientKey: string },
  db: BusinessDb = getBusinessDb(),
): Promise<RecipientSummary> {
  const [contacts, preferences, [push]] = await Promise.all([
    db
      .select({ channel: recipientContacts.channel, address: recipientContacts.address })
      .from(recipientContacts)
      .where(and(eq(recipientContacts.appId, input.appId), eq(recipientContacts.recipientKey, input.recipientKey))),
    getChannelPreferences(input, db),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.appId, input.appId), eq(pushSubscriptions.recipientKey, input.recipientKey))),
  ])
  const addressOf = (channel: ContactChannelKind): string | null =>
    contacts.find((contact) => contact.channel === channel)?.address ?? null
  const email = addressOf('email')
  const webhook = addressOf('webhook')
  return {
    recipientKey: input.recipientKey,
    email: { set: email !== null, masked: email === null ? null : maskEmail(email) },
    webhook: { set: webhook !== null, masked: webhook === null ? null : maskWebhookUrl(webhook) },
    push: { subscriptions: push?.count ?? 0 },
    preferences,
  }
}

// Keyset page over the app's recipients, in key order. The primary key serves it directly, and every
// recipient appears here from its first write, including one that only received a notification.
export async function listRecipientKeys(
  input: { appId: string; limit: number; after: string | null },
  db: BusinessDb = getBusinessDb(),
): Promise<{ recipientKeys: string[]; next: string | null }> {
  const take = input.limit + 1
  const rows = await db
    .select({ key: recipients.recipientKey })
    .from(recipients)
    .where(
      and(
        eq(recipients.appId, input.appId),
        input.after === null ? undefined : gt(recipients.recipientKey, input.after),
      ),
    )
    .orderBy(asc(recipients.recipientKey))
    .limit(take)
  const recipientKeys = rows.slice(0, input.limit).map((row) => row.key)
  return {
    recipientKeys,
    next: rows.length > input.limit ? (recipientKeys.at(-1) ?? null) : null,
  }
}

// Removes one contact channel. Returns whether anything was there, so repeating the call is safe.
// The recipient row stays: it still has notifications, preferences or subscriptions.
export async function clearRecipientContact(
  input: { appId: string; recipientKey: string; channel: ContactChannelKind },
  db: BusinessDb = getBusinessDb(),
): Promise<boolean> {
  const removed = await db
    .delete(recipientContacts)
    .where(
      and(
        eq(recipientContacts.appId, input.appId),
        eq(recipientContacts.recipientKey, input.recipientKey),
        eq(recipientContacts.channel, input.channel),
      ),
    )
    .returning({ channel: recipientContacts.channel })
  return removed.length > 0
}
