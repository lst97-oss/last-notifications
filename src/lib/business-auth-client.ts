'use client'

import { apiKeyClient } from '@better-auth/api-key/client'
import { useQuery } from '@tanstack/react-query'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  plugins: [apiKeyClient()],
})

export async function signOut(): Promise<void> {
  await authClient.signOut()
  window.location.href = '/dashboard'
}

export type SessionPrincipalClient = {
  userId: string
  email: string | null
  displayName: string | null
  provider: string
}

type SessionState = { principal: SessionPrincipalClient | null; dashboard: boolean }

// GET /api/session is the provider-neutral probe: it reports the signed-in
// identity and whether that identity may use the dashboard. A failed probe fails
// closed — no principal, no dashboard.
async function fetchSessionState(): Promise<SessionState> {
  try {
    const response = await fetch('/api/session', { headers: { accept: 'application/json' } })
    if (!response.ok) return { principal: null, dashboard: false }
    const payload = (await response.json()) as { data?: SessionState }
    return payload.data ?? { principal: null, dashboard: false }
  } catch {
    return { principal: null, dashboard: false }
  }
}

export const SESSION_QUERY_KEY = ['dashboard-session'] as const

export function useSessionPrincipal(): {
  principal: SessionPrincipalClient | null
  dashboard: boolean
  isPending: boolean
} {
  const { data, isPending } = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSessionState,
    staleTime: 30_000,
  })
  return {
    principal: data?.principal ?? null,
    dashboard: data?.dashboard ?? false,
    isPending,
  }
}
