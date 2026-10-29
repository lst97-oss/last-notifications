import { lookup as dnsLookup } from 'node:dns'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP, type LookupFunction } from 'node:net'

import { isPublicAddress } from '@/server/modules/notifications/domain/public-address'
import { ChannelError } from '@/server/plugins/notification-channels'

export type PostOptions = {
  headers: Record<string, string>
  timeoutMs: number
  signal: AbortSignal
  allowPrivate: boolean
}

export type WebhookPost = (url: string, body: string, options: PostOptions) => Promise<{ status: number }>

function blocked(): ChannelError {
  return new ChannelError('WEBHOOK_URL_BLOCKED', 'Webhook address resolves to a non-public host', { retryable: false })
}

// Connect-time guard. It runs the system resolver and refuses the connection if any answer is not a public
// address, so a hostname whose DNS answer changes between a check and the connect cannot reach an internal
// address. This is the control that matters: the URL-text check only catches literal addresses.
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  const wantsAll = typeof options === 'object' && options.all === true
  const family = typeof options === 'object' ? (options.family ?? 0) : 0
  dnsLookup(hostname, { all: true, family, verbatim: true }, (error, addresses) => {
    if (error) return wantsAll ? callback(error, []) : callback(error, '', 0)
    if (addresses.some((entry) => !isPublicAddress(entry.address))) {
      return wantsAll ? callback(blocked(), []) : callback(blocked(), '', 0)
    }
    if (wantsAll) return callback(null, addresses)
    return callback(null, addresses[0].address, addresses[0].family)
  })
}

// A raw IP in the URL never reaches the lookup above, so the literal is refused here instead.
function privateLiteral(hostname: string): boolean {
  const address = hostname.replace(/^\[|\]$/g, '')
  return isIP(address) !== 0 && !isPublicAddress(address)
}

// POSTs a webhook body and resolves with the receiver's status. Redirects are never followed, the response
// body is discarded, and the request is aborted at the timeout or when the caller's signal fires.
export function postWebhook(url: string, body: string, options: PostOptions): Promise<{ status: number }> {
  const target = new URL(url)
  const send = target.protocol === 'https:' ? httpsRequest : httpRequest
  return new Promise((resolve, reject) => {
    if (options.signal.aborted) return reject(new ChannelError('HANDLER_TIMEOUT'))
    if (!options.allowPrivate && privateLiteral(target.hostname)) return reject(blocked())
    const request = send(
      target,
      {
        method: 'POST',
        headers: {
          ...options.headers,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
        // Development receivers on localhost opt in; production always takes the guarded lookup.
        lookup: options.allowPrivate ? undefined : guardedLookup,
        timeout: options.timeoutMs,
      },
      (response) => {
        response.resume()
        resolve({ status: response.statusCode ?? 0 })
      },
    )
    request.on('timeout', () => request.destroy(new ChannelError('HANDLER_TIMEOUT')))
    request.on('error', (error) => {
      reject(error instanceof ChannelError ? error : new ChannelError('WEBHOOK_UNREACHABLE', error.message))
    })
    options.signal.addEventListener('abort', () => request.destroy(new ChannelError('HANDLER_TIMEOUT')), { once: true })
    request.end(body)
  })
}
