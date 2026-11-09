// Browser push services a subscription may name. The worker calls the endpoint a subscription names, so a user
// must not be able to name any other host: that would make the server call a host the user picks.
// Add a host here when a browser you support uses it.
const PUSH_HOSTS = new Set(['fcm.googleapis.com'])
const PUSH_HOST_SUFFIXES = ['push.services.mozilla.com', 'push.apple.com', 'notify.windows.com']

export function isPushServiceEndpoint(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false
  const host = url.hostname
  return PUSH_HOSTS.has(host) || PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(`.${suffix}`))
}
