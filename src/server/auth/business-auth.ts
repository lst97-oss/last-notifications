import { apiKey } from '@better-auth/api-key'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { getBootstrapEmail, getBusinessAuthSettings } from '@/server/auth/business-auth-config'
import type { SessionPrincipal } from '@/server/auth/principal'
import { createRegisteredOrigins } from '@/server/auth/registered-origins'
import { getBusinessDb } from '@/server/db/business-sql'
import { account, apikey, session, user, verification } from '@/server/db/schema'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'
import { listAppOrigins } from '@/server/modules/apps/infrastructure/app-repository'
import { getRequestLogger } from '@/server/observability/logger'
import { installedOpenApiPlugins } from '@/server/openapi/config'

// Every origin an app has registered. Better Auth checks the Origin header and
// the callbackURL against this list, so a registered consumer site can start and
// finish sign-in without a restart.
const registeredOrigins = createRegisteredOrigins(listAppOrigins, {
  onError: (error) =>
    getRequestLogger()
      .child({ component: 'auth' })
      .warn('auth.origins.read_failed', { message: error instanceof Error ? error.message : String(error) }),
})

// Credentialed CORS for /api/auth/* asks the same list: only registered origins
// may read an auth response that carries the user's session.
export function isRegisteredAuthOrigin(origin: string): Promise<boolean> {
  return registeredOrigins.has(origin)
}

// API keys: user-owned, scoped per key. App tenancy lives in api_key_apps, and
// permissions use { notifications: ['send'], … }. Server routes set both via
// auth.api; clients can never set permissions.
function businessApiKeyPlugin() {
  return apiKey({
    customAPIKeyGetter: (ctx) => {
      const raw = ctx.headers?.get('x-api-key') ?? ctx.headers?.get('authorization')
      if (!raw) return null
      return raw.startsWith('Bearer ') ? raw.slice('Bearer '.length) : raw
    },
    defaultPrefix: 'lnk_',
    enableMetadata: true,
    requireName: true,
  })
}

function createBusinessAuth(setup = false) {
  return betterAuth({
    ...getBusinessAuthSettings(undefined, setup),
    database: drizzleAdapter(getBusinessDb(), {
      provider: 'pg',
      schema: { user, session, account, verification, apikey },
    }),
    plugins: [businessApiKeyPlugin(), tanstackStartCookies(), ...installedOpenApiPlugins],
    ...(setup
      ? {}
      : {
          // Better Auth calls this at init without a request; that call gets no
          // origins, so the database is only read for real requests.
          trustedOrigins: async (request?: Request) => (request ? [...(await registeredOrigins.list())] : []),
          databaseHooks: {
            user: {
              create: {
                // Closed by default: the first account arrives via the setup
                // instance (POST /api/initial-admin). AUTH_BOOTSTRAP_EMAIL
                // relaxes this for exactly one address so headless deploys can
                // create their first admin without the setup form.
                before: async (incoming) => {
                  if (await hasInstanceAdmin()) return
                  const bootstrapEmail = getBootstrapEmail()
                  if (bootstrapEmail && incoming?.email?.toLowerCase() === bootstrapEmail) return
                  return false
                },
              },
            },
          },
        }),
  })
}

let instance: ReturnType<typeof createBusinessAuth> | undefined
let setupInstance: ReturnType<typeof createBusinessAuth> | undefined

export function getBusinessAuth() {
  if (!instance) instance = createBusinessAuth()
  return instance
}

export function getBusinessSetupAuth() {
  if (!setupInstance) setupInstance = createBusinessAuth(true)
  return setupInstance
}

export async function getBusinessSession(headers: Headers) {
  return getBusinessAuth().api.getSession({ headers })
}

// SessionAdapter entry for the built-in provider. Returns null when no session
// cookie is present.
export async function resolveBetterAuthSession(request: Request): Promise<SessionPrincipal | null> {
  const current = await getBusinessSession(request.headers)
  if (!current) return null
  return {
    userId: current.user.id,
    email: current.user.email,
    displayName: current.user.name,
    image: current.user.image ?? null,
    credential: { kind: 'session', provider: 'better-auth' },
  }
}
