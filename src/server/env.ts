import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PAYLOAD_SECRET: z.string().min(1, 'PAYLOAD_SECRET is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PAYLOAD_PUBLIC_SERVER_URL: z.string().min(1, 'PAYLOAD_PUBLIC_SERVER_URL is required'),
})

export type ServerEnv = z.infer<typeof envSchema>

let cached: ServerEnv | null = null

export function getServerEnv(): ServerEnv {
  if (cached) return cached
  // The Payload CLI (generate:types, migrate:create) runs under Node, not
  // Bun — so this must work in both runtimes. Prefer Bun.env when present.
  const source = typeof Bun !== 'undefined' ? Bun.env : process.env
  cached = envSchema.parse(source)
  return cached
}
