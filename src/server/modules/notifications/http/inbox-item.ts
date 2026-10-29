import type { NotificationRecord } from '@/server/modules/notifications/domain/notification'
import type { InboxItem } from '@/server/openapi/response-schemas'

// The one projection from an internal record to the wire item. REST, SSE and the WS gateway all use it.
export function toInboxItem(record: NotificationRecord): InboxItem {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    body: record.body,
    data: record.data,
    priority: record.priority,
    readAt: record.readAt,
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
  }
}
