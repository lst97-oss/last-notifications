'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { scopesOfPermissions } from '@/lib/api-key-scopes'
import type { ApiKeyRecord } from '@/lib/api-keys'

export function ApiKeyRow({
  apiKey,
  pending,
  onEdit,
  onToggleEnabled,
  onRequestDelete,
}: {
  apiKey: ApiKeyRecord
  pending: boolean
  onEdit: () => void
  onToggleEnabled: () => void
  onRequestDelete: () => void
}) {
  const boundApp = apiKey.metadata?.app ?? null
  const granted = scopesOfPermissions(apiKey.permissions)
  const details = [`created ${new Date(apiKey.createdAt).toLocaleDateString()}`]
  if (apiKey.expiresAt) details.push(`expires ${new Date(apiKey.expiresAt).toLocaleDateString()}`)
  details.push(apiKey.lastRequest ? `last used ${new Date(apiKey.lastRequest).toLocaleDateString()}` : 'never used')
  details.push(granted.join(', ') || 'no permissions')

  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>
          {apiKey.name ?? '(unnamed)'}
          <Badge variant="secondary">{boundApp ? `app: ${boundApp}` : 'instance'}</Badge>
          {!apiKey.enabled ? <Badge variant="outline">Disabled</Badge> : null}
        </ItemTitle>
        <ItemDescription>
          <span className="font-mono">{apiKey.start ?? apiKey.prefix ?? apiKey.id}</span> · {details.join(' · ')}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onToggleEnabled}>
          {apiKey.enabled ? 'Disable' : 'Enable'}
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={onRequestDelete}>
          Delete
        </Button>
      </ItemActions>
    </Item>
  )
}
