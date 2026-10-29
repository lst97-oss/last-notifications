// The channel vocabulary is a closed set in the database CHECK constraints, so
// the TS union is derived here and nowhere else.
export const NOTIFICATION_CHANNELS = ['inapp', 'email', 'webpush', 'webhook'] as const

// Channels a recipient can be reached on through a stored address (email, webhook URL).
export const CONTACT_CHANNELS = ['email', 'webhook'] as const
export type ContactChannelKind = (typeof CONTACT_CHANNELS)[number]

// Channels a publish delivers to when the request names none. Webhook is opt-in: a publish that
// does not name it must not create deliveries for every existing app.
export const DEFAULT_CHANNELS = ['inapp', 'email', 'webpush'] as const
export type NotificationChannelKind = (typeof NOTIFICATION_CHANNELS)[number]
