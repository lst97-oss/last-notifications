import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'

import { buildOpenApiDocument } from '@/server/openapi/registry'

type Operation = { security?: unknown; responses: Record<string, unknown> }
type PathItem = Record<string, Operation>

// Each api.v1 route file → the methods it exports and its OpenAPI path.
// `api.v1.apps.$appKey.inbox.ts` is `/api/v1/apps/{appKey}/inbox`.
function routeFiles(): Array<{ method: string; path: string }> {
  const dir = new URL('../src/routes/', import.meta.url)
  return readdirSync(dir)
    .filter((name) => name.startsWith('api.v1.') && name.endsWith('.ts'))
    .flatMap((name) => {
      const segments = name
        .replace(/\.ts$/, '')
        .split('.')
        .map((segment) => segment.replace(/^\$(\w+)$/, '{$1}'))
      const path = `/${segments.join('/')}`
      const source = readFileSync(new URL(name, dir), 'utf8')
      return [...source.matchAll(/^\s+(GET|POST|PUT|PATCH|DELETE):/gm)].map(([, method]) => ({
        method: method.toLowerCase(),
        path,
      }))
    })
}

describe('buildOpenApiDocument', () => {
  const paths = (buildOpenApiDocument('http://localhost').paths ?? {}) as Record<string, PathItem>

  test('documents every api.v1 route, so a new route cannot ship without a spec entry', () => {
    const missing = routeFiles().filter(({ method, path }) => !paths[path]?.[method])
    expect(missing).toEqual([])
  })

  test('every operation declares its security and a success response', () => {
    for (const [path, item] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(item)) {
        expect(operation.security, `${method} ${path}`).toBeDefined()
        const success = Object.keys(operation.responses).filter((code) => /^2\d\d$/.test(code))
        expect(success.length, `${method} ${path}`).toBeGreaterThan(0)
      }
    }
  })
})
