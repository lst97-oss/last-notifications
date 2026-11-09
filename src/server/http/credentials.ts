// The secret in an Authorization header, with or without "Bearer ". Null unless it starts with `prefix`, so an
// unrelated bearer token falls through to the session check.
export function prefixedBearer(authorization: string | null, prefix: string): string | null {
  const raw = authorization?.trim()
  if (!raw) return null
  const secret = /^bearer\s+/i.test(raw) ? raw.replace(/^bearer\s+/i, '').trim() : raw
  return secret.startsWith(prefix) ? secret : null
}
