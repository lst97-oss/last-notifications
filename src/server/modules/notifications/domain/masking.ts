// What a host sees back about a recipient's contact: enough to recognise it, never all of it.
// A webhook URL's path often carries a secret, so only its origin is shown.

export function maskEmail(address: string): string {
  const at = address.indexOf('@')
  if (at <= 0) return '***'
  // A one-letter name would show all of itself, so it shows none.
  const shown = at >= 2 ? address.slice(0, 1) : ''
  return `${shown}***${address.slice(at)}`
}

export function maskWebhookUrl(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return '***'
  }
}
