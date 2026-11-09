import { describe, expect, test } from 'bun:test'

import { apiKeyCreateFormSchema, apiKeyEditFormSchema } from '@/lib/admin-schema'

const valid = {
  target: 'last-comments',
  name: 'Site key',
  features: ['inApp'],
  expiry: '1y',
  scopes: ['notifications:create'],
  perMinute: 600,
}

function createIssues(input: unknown): string[] {
  const result = apiKeyCreateFormSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('api key create form', () => {
  test('a complete draft passes', () => {
    expect(createIssues(valid)).toEqual([])
  })

  test('an app must be chosen', () => {
    expect(createIssues({ ...valid, target: null })).toEqual(['Choose an app'])
  })

  test('the name is required, and blank spaces do not count', () => {
    expect(createIssues({ ...valid, name: '   ' })).toEqual(['Enter a name'])
  })

  test('at least one permission is required', () => {
    expect(createIssues({ ...valid, scopes: [] })).toEqual(['Choose at least one permission'])
  })

  test('requests per minute are a whole number from 1 to 1,000,000', () => {
    expect(createIssues({ ...valid, perMinute: 0 })).toEqual(['Use at least 1 request a minute'])
    expect(createIssues({ ...valid, perMinute: 1_000_001 })).toEqual(['Use at most 1,000,000 requests a minute'])
    expect(createIssues({ ...valid, perMinute: 1.5 })).toEqual(['Enter a whole number'])
  })
})

describe('api key edit form', () => {
  test('at least one permission is required', () => {
    expect(apiKeyEditFormSchema.safeParse({ scopes: [] }).success).toBe(false)
    expect(apiKeyEditFormSchema.safeParse({ scopes: ['notifications:create'] }).success).toBe(true)
  })
})
