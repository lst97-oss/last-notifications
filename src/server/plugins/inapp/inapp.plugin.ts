import { publishNotificationEvent } from '@/server/modules/notifications/infrastructure/stream-bus'
import type { NotificationChannel } from '@/server/plugins/notification-channels'

// The inbox row is written by the publish transaction, so it is the in-app delivery. Its send is the
// live stream, fired inline after commit: a browser updates without waiting for the worker.
export const inappChannel: NotificationChannel = {
  id: 'inapp',
  apiVersion: 1,
  channel: 'inapp',
  delivery: 'inline',
  describe: () => ({
    id: 'inapp',
    apiVersion: 1,
    enabled: true,
    detail: 'Built in. Recipients see notifications in their browser inbox.',
    facts: [],
    channels: ['inapp'],
  }),
  async send({ notification, app, recipientKey }) {
    await publishNotificationEvent(app.id, recipientKey, notification)
  },
}
