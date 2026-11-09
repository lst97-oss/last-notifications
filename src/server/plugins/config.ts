import { emailChannel } from '@/server/plugins/email/email.plugin'
import { inappChannel } from '@/server/plugins/inapp/inapp.plugin'
import { type NotificationChannel, validateChannelManifest } from '@/server/plugins/notification-channels'
import { webhookChannel } from '@/server/plugins/webhook/webhook.plugin'
import { webpushChannel } from '@/server/plugins/webpush/webpush.plugin'

// The install list and the delivery order. Adding a vendor channel = one entry
// here plus its folder; removing it leaves its DB rows in place. Validation runs
// once at load, so a broken manifest fails the process, not a request.
export const installedNotificationChannels = validateChannelManifest([
  inappChannel,
  webpushChannel,
  emailChannel,
  webhookChannel,
] satisfies readonly NotificationChannel[])

export function getNotificationChannels(): readonly NotificationChannel[] {
  return installedNotificationChannels
}

export function getNotificationChannel(id: string): NotificationChannel | undefined {
  return installedNotificationChannels.find((channel) => channel.id === id)
}
