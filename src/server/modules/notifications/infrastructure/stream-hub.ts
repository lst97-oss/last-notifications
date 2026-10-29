import type { NotificationRecord } from '@/server/modules/notifications/domain/notification'

export type StreamEvent = { cursor: string; notification: NotificationRecord }
export type StreamListener = (event: StreamEvent) => void

// In-process fan-out. One app instance owns the connections it accepted; a second
// instance reaches them through stream-bus.ts (Postgres LISTEN/NOTIFY), which
// calls publishToRecipient here after loading the row.
const subscribers = new Map<string, Set<StreamListener>>()

function keyOf(appId: string, recipientKey: string): string {
  return `${appId}:${recipientKey}`
}

export function subscribeToRecipient(appId: string, recipientKey: string, listener: StreamListener): () => void {
  const key = keyOf(appId, recipientKey)
  const listeners = subscribers.get(key) ?? new Set<StreamListener>()
  listeners.add(listener)
  subscribers.set(key, listeners)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) subscribers.delete(key)
  }
}

export function publishToRecipient(appId: string, recipientKey: string, event: StreamEvent): void {
  const listeners = subscribers.get(keyOf(appId, recipientKey))
  if (!listeners) return
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // A broken connection must never fail the publish request.
    }
  }
}

export function countRecipientSubscribers(appId: string, recipientKey: string): number {
  return subscribers.get(keyOf(appId, recipientKey))?.size ?? 0
}
