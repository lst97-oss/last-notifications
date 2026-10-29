import { createServerFunctionClient, payloadLayoutRoute } from '@payloadcms/tanstack-start/client'
import React from 'react'
import { payloadLayoutServerFn, payloadServerFn } from '@/payload/lib/server-fns'
import payloadAdminCss from '@/payload/styles/payload-admin.css?url'

export const payloadLayout = payloadLayoutRoute({
  load: payloadLayoutServerFn,
  serverFunction: createServerFunctionClient({ runServerFn: payloadServerFn }),
})

export function PayloadLayout() {
  useAdminStyleCleanup()
  return (
    <>
      {/* Component-rendered so React 19 hoists it on mount (SSR + client
      nav) and removes it on unmount. The route `head()` link is NOT used:
      TanStack never removes route head links on leave, so the admin sheet
      kept styling the public site after back-navigation. */}
      <link rel="stylesheet" href={payloadAdminCss} precedence="default" />
      <payloadLayout.component />
    </>
  )
}

// The component-rendered admin sheet above self-removes on unmount (React 19
// hoisted resource). What remains: Vite's injected <style> tags for Payload
// package paths plus RSC-injected Payload <link> tags (data-rsc-css-href) —
// TanStack never removes those on leave. Drop them by identity. Sub-route
// switches inside /admin keep this layout mounted, so no flash there.
function useAdminStyleCleanup() {
  React.useEffect(() => {
    return () => {
      document.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
        const href = el.getAttribute('href') ?? ''
        if (href.includes('@payloadcms')) el.remove()
      })
      document.querySelectorAll('style').forEach((el) => {
        const devId = el.getAttribute('data-vite-dev-id') ?? ''
        const text = el.textContent ?? ''
        if (devId.includes('@payloadcms') || text.startsWith('@layer payload-default, payload;')) el.remove()
      })
    }
  }, [])
}
