import type { StreamEvent } from '@/server/modules/notifications/infrastructure/stream-hub'

// Orders one stream's events. The backlog goes out first. A live event that arrives while the
// backlog is still being read is held, then sent after it, unless the backlog already carried it.
export function createLiveGate(send: (event: StreamEvent) => void) {
  let open = false
  const held: StreamEvent[] = []
  const backlogIds = new Set<string>()
  return {
    backlog(event: StreamEvent) {
      backlogIds.add(event.notification.id)
      send(event)
    },
    live(event: StreamEvent) {
      if (open) send(event)
      else held.push(event)
    },
    open() {
      open = true
      for (const event of held) if (!backlogIds.has(event.notification.id)) send(event)
      held.length = 0
      backlogIds.clear()
    },
  }
}
