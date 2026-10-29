// An API key as the API lists it. `permissions` is the parsed stored JSON map.
export type ApiKeyRecord = {
  id: string
  name: string | null
  start: string | null
  prefix: string | null
  enabled: boolean
  expiresAt: Date | null
  lastRequest: Date | null
  createdAt: Date
  metadata: { app: string } | null
  permissions: Record<string, string[]> | null
}
