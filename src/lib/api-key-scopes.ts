// Permissions a notification API key can hold, as `resource:verb` with CRUD verbs. A key
// grants exactly the listed verbs; none implies another. The key's app binding decides
// which of them can act. An app key's `apps:*` act on its own app only.
export const API_KEY_SCOPES = [
  'apps:create', // refused on every key: apps are created in the dashboard
  'apps:read',
  'apps:update',
  'apps:delete',
  'notifications:create',
  'notifications:read',
  'notifications:update',
  'notifications:delete',
  'tokens:create',
  'recipients:read',
  'recipients:update',
  'recipients:delete',
  'channels:read',
  'channels:update',
] as const

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]

// Permissions that only act on an app-bound key. `apps:*` are checked by the apps routes.
export const APP_SCOPES: readonly ApiKeyScope[] = API_KEY_SCOPES.filter((scope) => !scope.startsWith('apps:'))

// A feature is a channel the host uses. It grants the permissions the host's own server needs
// with the key; the browser then acts through a recipient token minted with tokens:create.
export const FEATURES = ['inApp', 'email', 'webpush', 'webhook'] as const
export type Feature = (typeof FEATURES)[number]

// Web Push adds no key permission: the browser subscribes with its own token. Email and webhook need the server
// to store each recipient's address, which only an app key may do.
export const FEATURE_SCOPES: Record<Feature, readonly ApiKeyScope[]> = {
  inApp: ['notifications:create', 'tokens:create'],
  email: ['recipients:update'],
  webpush: [],
  webhook: ['channels:update', 'recipients:update'],
}

// In-app is the minimum every host needs to show notifications, so it is on by default.
export const DEFAULT_FEATURES: readonly Feature[] = ['inApp']

// The scopes the selected features need, in picker order.
export function scopesForFeatures(features: readonly Feature[]): ApiKeyScope[] {
  return API_KEY_SCOPES.filter((scope) => features.some((feature) => FEATURE_SCOPES[feature].includes(scope)))
}

// Scopes after one feature is switched. Turning it on adds its scopes and keeps the rest. Turning it
// off drops the scopes it grants, unless another selected feature still needs them. A scope the feature does
// not grant is never touched, even one the user ticked by hand.
export function scopesAfterFeatureToggle(
  scopes: readonly ApiKeyScope[],
  nextFeatures: readonly Feature[],
  feature: Feature,
): ApiKeyScope[] {
  const own = FEATURE_SCOPES[feature]
  if (nextFeatures.includes(feature)) {
    return API_KEY_SCOPES.filter((scope) => scopes.includes(scope) || own.includes(scope))
  }
  const stillNeeded = scopesForFeatures(nextFeatures)
  return API_KEY_SCOPES.filter(
    (scope) => scopes.includes(scope) && (!own.includes(scope) || stillNeeded.includes(scope)),
  )
}

// The channel names the server reports, mapped to the feature that each one backs.
const CHANNEL_FEATURES: Record<string, Feature> = {
  inapp: 'inApp',
  email: 'email',
  webpush: 'webpush',
  webhook: 'webhook',
}

// The features an app has on. A channel counts only when the server has it installed and the app's switch is on.
export function featuresOfChannels(
  channels: readonly { channel: string; installed: boolean; enabled: boolean }[],
): Feature[] {
  return FEATURES.filter((feature) =>
    channels.some((item) => item.installed && item.enabled && CHANNEL_FEATURES[item.channel] === feature),
  )
}

// The features and scopes once `enabled` is the selection. Features switch one at a time, and each switch
// only touches the scopes that feature grants.
export function applyFeatureSet(
  current: { features: readonly Feature[]; scopes: readonly ApiKeyScope[] },
  enabled: readonly Feature[],
): { features: Feature[]; scopes: ApiKeyScope[] } {
  let features: Feature[] = [...current.features]
  let scopes: ApiKeyScope[] = [...current.scopes]
  for (const feature of FEATURES) {
    const on = enabled.includes(feature)
    if (on === features.includes(feature)) continue
    features = on ? [...features, feature] : features.filter((item) => item !== feature)
    scopes = scopesAfterFeatureToggle(scopes, features, feature)
  }
  return { features, scopes }
}

export type ScopeResource = 'apps' | 'notifications' | 'tokens' | 'recipients' | 'channels'

export type ScopeGroup = { resource: ScopeResource; label: string; scopes: readonly ApiKeyScope[] }

// The picker section, grouped by resource. The same list is offered for every key; the
// app binding, not the picker, decides which permissions can act.
export const SCOPE_GROUPS: readonly ScopeGroup[] = [
  {
    resource: 'apps',
    label: 'Apps',
    scopes: ['apps:read', 'apps:update', 'apps:delete'],
  },
  {
    resource: 'notifications',
    label: 'Notifications',
    scopes: ['notifications:create', 'notifications:read', 'notifications:update', 'notifications:delete'],
  },
  { resource: 'tokens', label: 'Browser tokens', scopes: ['tokens:create'] },
  {
    resource: 'recipients',
    label: 'Recipients',
    scopes: ['recipients:read', 'recipients:update', 'recipients:delete'],
  },
  { resource: 'channels', label: 'Delivery settings', scopes: ['channels:read', 'channels:update'] },
]

export const SCOPE_LABELS: Record<ApiKeyScope, string> = {
  'apps:create': 'Create apps',
  'apps:read': 'Read apps',
  'apps:update': 'Update apps',
  'apps:delete': 'Delete apps',
  'notifications:create': 'Publish notifications',
  'notifications:read': 'Read inboxes',
  'notifications:update': 'Mark, archive and restore',
  'notifications:delete': 'Delete notifications',
  'tokens:create': 'Mint browser tokens',
  'recipients:read': 'Read recipients',
  'recipients:update': 'Set contacts and preferences',
  'recipients:delete': 'Clear contacts and push subscriptions',
  'channels:read': 'Read delivery settings',
  'channels:update': 'Change delivery settings',
}

export const SCOPE_DESCRIPTIONS: Record<ApiKeyScope, string> = {
  'apps:create': 'Refused on every key. Create apps in the dashboard.',
  'apps:read': 'List apps and read their channel settings. App keys see only their own app.',
  'apps:update': 'Change app names, origins and channel switches. App keys change only their own app.',
  'apps:delete': 'Delete apps. App keys delete only their own app.',
  'notifications:create': 'Publish notifications.',
  'notifications:read': "Read a recipient's inbox and unread count. Name the recipient.",
  'notifications:update': 'Mark notifications read, and archive or restore them.',
  'notifications:delete': 'Delete notifications. Pass the recipient with the key.',
  'tokens:create': 'Mint a browser token that reads one recipient’s inbox.',
  'recipients:read': "Read a recipient's masked contacts, preferences and push status.",
  'recipients:update': 'Set a recipient’s contact, preferences and push subscriptions.',
  'recipients:delete': 'Clear a recipient’s contact and remove push subscriptions.',
  'channels:read': "Read this app's delivery settings, without secrets.",
  'channels:update': "Set this app's webhook endpoint and rotate its signing secret.",
}

// The permissions a stored permission map grants, in picker order.
export function scopesOfPermissions(permissions: Record<string, string[]> | null | undefined): ApiKeyScope[] {
  if (!permissions) return []
  return API_KEY_SCOPES.filter((scope) => {
    const [resource, action] = scope.split(':') as [ScopeResource, string]
    return permissions[resource]?.includes(action)
  })
}
