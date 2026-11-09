import { describe, expect, test } from 'bun:test'

import {
  type ApiKeyScope,
  applyFeatureSet,
  DEFAULT_FEATURES,
  type Feature,
  featuresOfChannels,
  scopesAfterFeatureToggle,
  scopesForFeatures,
} from '@/lib/api-key-scopes'

describe('feature scopes', () => {
  test('in-app by default needs only publish and a browser token', () => {
    expect(scopesForFeatures(DEFAULT_FEATURES)).toEqual(['notifications:create', 'tokens:create'])
  })

  test('Web Push adds no key permission, and email adds the one that stores addresses', () => {
    const start = ['notifications:create', 'tokens:create'] as const
    expect(scopesAfterFeatureToggle(start, ['inApp', 'webpush'], 'webpush')).toEqual([...start])
    expect(scopesAfterFeatureToggle(start, ['inApp', 'email'], 'email').sort()).toEqual(
      ['notifications:create', 'recipients:update', 'tokens:create'].sort() as ApiKeyScope[],
    )
  })

  test('turning webhook on adds exactly its scopes and keeps the rest', () => {
    const next = scopesAfterFeatureToggle(['notifications:create', 'tokens:create'], ['inApp', 'webhook'], 'webhook')
    expect(next).toEqual(['notifications:create', 'tokens:create', 'recipients:update', 'channels:update'])
  })

  test('turning webhook off drops its scopes and keeps in-app', () => {
    const next = scopesAfterFeatureToggle(
      ['notifications:create', 'tokens:create', 'recipients:update', 'channels:update'],
      ['inApp'],
      'webhook',
    )
    expect(next).toEqual(['notifications:create', 'tokens:create'])
  })

  test('turning a feature off keeps permissions it does not grant', () => {
    const next = scopesAfterFeatureToggle(['notifications:create', 'tokens:create', 'notifications:read'], [], 'inApp')
    expect(next).toEqual(['notifications:read'])
  })

  test('turning a feature off removes a permission it grants, even one ticked by hand', () => {
    expect(scopesAfterFeatureToggle(['notifications:create', 'tokens:create'], [], 'inApp')).toEqual([])
  })
})

describe('app channels as features', () => {
  test('a channel counts only when it is installed and switched on', () => {
    const channels = [
      { channel: 'inapp', installed: true, enabled: true },
      { channel: 'email', installed: true, enabled: false },
      { channel: 'webpush', installed: false, enabled: true },
      { channel: 'webhook', installed: true, enabled: true },
    ]
    expect(featuresOfChannels(channels)).toEqual(['inApp', 'webhook'])
  })

  test('picking an app unticks what it lacks and ticks what it has, with their permissions', () => {
    const start = {
      features: ['inApp'] as Feature[],
      scopes: ['notifications:create', 'tokens:create'] as ApiKeyScope[],
    }
    const next = applyFeatureSet(start, ['webhook'])
    expect(next.features).toEqual(['webhook'])
    expect(next.scopes).toEqual(['recipients:update', 'channels:update'])
  })

  test('an app that has email on adds the permission that stores addresses', () => {
    const start = {
      features: ['inApp'] as Feature[],
      scopes: ['notifications:create', 'tokens:create'] as ApiKeyScope[],
    }
    const next = applyFeatureSet(start, ['inApp', 'email'])
    expect(next.features).toEqual(['inApp', 'email'])
    expect([...next.scopes].sort()).toEqual(
      ['notifications:create', 'recipients:update', 'tokens:create'].sort() as ApiKeyScope[],
    )
  })

  test('applying an app keeps permissions the user ticked by hand', () => {
    const start = {
      features: ['inApp'] as Feature[],
      scopes: ['notifications:create', 'tokens:create', 'notifications:read'] as ApiKeyScope[],
    }
    expect(applyFeatureSet(start, ['inApp']).scopes).toEqual([
      'notifications:create',
      'tokens:create',
      'notifications:read',
    ])
  })
})
