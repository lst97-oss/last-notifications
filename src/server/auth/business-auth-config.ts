import { z } from 'zod'

import { productionSecretProblem } from '@/server/security/secret-placeholders'

const optionalCredential = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
)

const businessAuthEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
    BETTER_AUTH_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    GOOGLE_CLIENT_ID: optionalCredential,
    GOOGLE_CLIENT_SECRET: optionalCredential,
    AUTH_BOOTSTRAP_EMAIL: optionalCredential,
  })
  .refine(({ GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET }) => Boolean(GOOGLE_CLIENT_ID) === Boolean(GOOGLE_CLIENT_SECRET), {
    message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together',
    path: ['GOOGLE_CLIENT_ID'],
  })
  .refine(
    ({ NODE_ENV, BETTER_AUTH_SECRET }) => NODE_ENV !== 'production' || !productionSecretProblem(BETTER_AUTH_SECRET),
    { message: 'BETTER_AUTH_SECRET is a placeholder or too short for production', path: ['BETTER_AUTH_SECRET'] },
  )

export type BusinessAuthSettings = {
  baseURL: string
  secret: string
  emailAndPassword: { enabled: true; disableSignUp: boolean }
  account: {
    accountLinking: { enabled: true; trustedProviders: ['google']; requireLocalEmailVerified: false }
  }
  socialProviders?: { google: { clientId: string; clientSecret: string } }
}

export function getBusinessAuthSettings(
  source: Record<string, string | undefined> = typeof Bun !== 'undefined' ? Bun.env : process.env,
  allowPasswordSignUp = false,
): BusinessAuthSettings {
  const env = businessAuthEnvSchema.parse(source)
  return {
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true, disableSignUp: !allowPasswordSignUp },
    // Google's email_verified claim is the ownership proof; the first admin signs
    // up with a password, so its local row stays unverified without this.
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
        requireLocalEmailVerified: false,
      },
    },
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { socialProviders: { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } } }
      : {}),
  }
}

// The single address allowed to create the first account without the setup form,
// so a headless deploy can bootstrap itself.
export function getBootstrapEmail(
  source: Record<string, string | undefined> = typeof Bun !== 'undefined' ? Bun.env : process.env,
): string | null {
  const raw = source.AUTH_BOOTSTRAP_EMAIL?.trim()
  return raw ? raw.toLowerCase() : null
}
