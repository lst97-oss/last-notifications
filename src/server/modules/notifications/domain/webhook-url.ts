import { isIP } from 'node:net'

import { isPublicAddress } from '@/server/modules/notifications/domain/public-address'

export const WEBHOOK_URL_MAX_LENGTH = 2048

// Why a stored webhook URL is refused, or null when it may be stored. Checks the URL text only; the
// connect-time lookup in the webhook channel refuses a hostname that resolves to a private address.
export function webhookUrlProblem(raw: string, options: { allowPrivate: boolean }): string | null {
  if (raw.length > WEBHOOK_URL_MAX_LENGTH) return `must be at most ${WEBHOOK_URL_MAX_LENGTH} characters`
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return 'must be a valid URL'
  }
  if (url.username || url.password) return 'must not contain credentials'
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === '') return 'must name a host'
  if (url.protocol !== 'https:' && !(options.allowPrivate && url.protocol === 'http:')) {
    return 'must use https'
  }
  if (options.allowPrivate) return null
  if (host === 'localhost' || host.endsWith('.localhost')) return 'must not point at a private network'
  if (isIP(host) !== 0 && !isPublicAddress(host)) return 'must not point at a private network'
  return null
}
