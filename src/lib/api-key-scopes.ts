// Permissions a notification API key can hold, as `resource:verb` with CRUD verbs. A key
// grants exactly the listed verbs; none implies another. The key's app binding decides
// which of them can act, and `apps:*` are instance-only.
export const API_KEY_SCOPES = [
  'apps:create',
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

// Permissions that only act on an app-bound key. `apps:*` are instance-only.
export const APP_SCOPES: readonly ApiKeyScope[] = API_KEY_SCOPES.filter((scope) => !scope.startsWith('apps:'))

// Least privilege for a new key, per binding: read-only instance keys; an app key publishes,
// reads and updates its own inbox, and cannot delete notifications or mint browser tokens.
export const DEFAULT_INSTANCE_SCOPES: ApiKeyScope[] = ['apps:read']
export const DEFAULT_APP_SCOPES: ApiKeyScope[] = ['notifications:create', 'notifications:read', 'notifications:update']

export type ScopeResource = 'apps' | 'notifications' | 'tokens' | 'recipients' | 'channels'

export type ScopeGroup = { resource: ScopeResource; label: string; scopes: readonly ApiKeyScope[] }

// The picker section, grouped by resource. The same list is offered for every key; the
// app binding, not the picker, decides which permissions can act.
export const SCOPE_GROUPS: readonly ScopeGroup[] = [
  {
    resource: 'apps',
    label: 'Apps',
    scopes: ['apps:create', 'apps:read', 'apps:update', 'apps:delete'],
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
  'apps:create': 'Create apps. Instance keys only.',
  'apps:read': 'List apps and read their channel settings. Instance keys only.',
  'apps:update': 'Change app names, origins and channel switches. Instance keys only.',
  'apps:delete': 'Delete apps. Instance keys only.',
  'notifications:create': 'Publish notifications.',
  'notifications:read': "Read an app's inbox, stream, and Web Push key.",
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
