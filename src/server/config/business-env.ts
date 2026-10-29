import { z } from 'zod'

import { getServerEnv } from '@/server/env'

// Lazy + dual-runtime (Bun/Node) — see AGENTS.md in this directory.
// Resolution order: BUSINESS_DATABASE_URL, else DATABASE_URL.

const businessEnvSchema = z.object({
  BUSINESS_DATABASE_URL: z.string().optional(),
})

export function getBusinessEnv(): { connectionString: string } {
  const source = typeof Bun !== 'undefined' ? Bun.env : process.env
  const parsed = businessEnvSchema.parse(source)
  return { connectionString: parsed.BUSINESS_DATABASE_URL ?? getServerEnv().DATABASE_URL }
}
