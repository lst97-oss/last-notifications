import type { ApiKeyScope } from '@/lib/api-key-scopes'

// Provider-neutral identity resolved for every request. Routes and guards
// consume only this shape — never better-auth sessions directly, so adding a
// credential kind means producing a Principal, not touching callers.
export type PrincipalCredential =
  | { kind: 'session'; provider: string }
  | { kind: 'service-key'; keyId: string; appKey: string | null; scopes: ApiKeyScope[] }

export type Principal = {
  userId: string
  email: string | null
  displayName: string | null
  image?: string | null
  credential: PrincipalCredential
}

export type SessionPrincipal = Omit<Principal, 'credential'> & {
  credential: Extract<PrincipalCredential, { kind: 'session' }>
}

export type SessionAdapter = {
  name: string
  resolveSession: (request: Request) => Promise<SessionPrincipal | null>
}
