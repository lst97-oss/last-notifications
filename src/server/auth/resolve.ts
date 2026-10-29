import { resolveBetterAuthSession } from '@/server/auth/business-auth'
import type { Principal, SessionPrincipal } from '@/server/auth/principal'

export type { Principal, SessionPrincipal }

// better-auth is the only session provider in v1. The adapter shape stays so a
// second provider is a new entry, not a caller change.
const adapters = [{ name: 'better-auth', resolveSession: (request: Request) => resolveBetterAuthSession(request) }]

export async function resolveSessionPrincipal(request: Request): Promise<SessionPrincipal | null> {
  for (const adapter of adapters) {
    const principal = await adapter.resolveSession(request)
    if (principal) return principal
  }
  return null
}
