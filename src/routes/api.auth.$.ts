import { HttpStatus } from '@lst97-oss/last-httprism'
import { createFileRoute } from '@tanstack/react-router'

import { getBusinessAuth, isRegisteredAuthOrigin } from '@/server/auth/business-auth'
import { applyCors } from '@/server/http/cors'
import { withContext } from '@/server/http/with-context'
import { selfHostScalarPage } from '@/server/openapi/reference'

const AUTH_METHODS = 'GET, POST, OPTIONS'

// Only a registered app origin may read an auth response with the session
// cookie. Anything else gets no CORS headers, and the browser blocks the read.
async function allowedOrigin(request: Request): Promise<string | null> {
  const origin = request.headers.get('origin')
  if (!origin) return null
  return (await isRegisteredAuthOrigin(origin)) ? origin : null
}

// Rebuilds the response before adding headers: some handler responses (redirects)
// are immutable, and the Set-Cookie headers must survive the copy. CORS wraps
// withContext rather than sitting inside it, so error responses carry the headers
// too and the dashboard can show the server's message.
async function respondWithCors(request: Request): Promise<Response> {
  // The open-api plugin's reference page is rewritten to the self-hosted Scalar bundle.
  const response = await withContext(async () => selfHostScalarPage(await getBusinessAuth().handler(request)))({
    request,
  })
  const copy = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  })
  return applyCors(copy, await allowedOrigin(request), AUTH_METHODS)
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => respondWithCors(request),
      POST: ({ request }) => respondWithCors(request),
      OPTIONS: async ({ request }) =>
        applyCors(
          new Response(null, { status: HttpStatus.NO_CONTENT.code }),
          await allowedOrigin(request),
          AUTH_METHODS,
        ),
    },
  },
})
