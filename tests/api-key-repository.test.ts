import { describe, expect, test } from 'bun:test'

import { permissionsToScopes, scopesToPermissions } from '@/server/modules/api-keys/infrastructure/api-key-repository'

describe('scope mapping', () => {
  test('round-trips a mixed permission set', () => {
    const scopes = ['notifications:read', 'notifications:create', 'recipients:update', 'tokens:create'] as const
    expect(permissionsToScopes(scopesToPermissions([...scopes]))).toEqual([...scopes])
  })

  test('maps a resource with several verbs into one entry', () => {
    expect(scopesToPermissions(['notifications:read', 'notifications:delete'])).toEqual({
      notifications: ['read', 'delete'],
    })
  })

  test('a verb never implies another', () => {
    expect(permissionsToScopes({ notifications: ['update'] })).toEqual(['notifications:update'])
    expect(permissionsToScopes({ notifications: ['update'] })).not.toContain('notifications:read')
  })

  test('drops unknown verbs when reading stored permissions', () => {
    expect(permissionsToScopes({ notifications: ['create', 'teleport'] })).toEqual(['notifications:create'])
  })

  test('accepts the plugin JSON string form', () => {
    expect(permissionsToScopes('{"apps":["read"]}')).toEqual(['apps:read'])
  })

  test('treats malformed permissions as no scopes', () => {
    expect(permissionsToScopes('{oops')).toEqual([])
    expect(permissionsToScopes(null)).toEqual([])
  })
})
