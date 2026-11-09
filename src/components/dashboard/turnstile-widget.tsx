'use client'

import { useEffect, useEffectEvent, useRef } from 'react'

const SCRIPT_ID = 'cf-turnstile'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      theme: 'light' | 'dark'
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    },
  ) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

// Cloudflare's script is the platform widget; a token is single-use, so the
// caller remounts this component (via `key`) after a rejected sign-in.
export function TurnstileWidget({ siteKey, onToken }: { siteKey: string; onToken: (token: string | null) => void }) {
  const container = useRef<HTMLDivElement>(null)
  // Reads the latest onToken without re-running the effect, so a new callback identity never rebuilds the widget.
  const reportToken = useEffectEvent((token: string | null) => onToken(token))

  useEffect(() => {
    let widgetId: string | null = null
    let cancelled = false

    const render = () => {
      if (cancelled || !container.current || !window.turnstile) return
      widgetId = window.turnstile.render(container.current, {
        sitekey: siteKey,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        callback: (token) => reportToken(token),
        'expired-callback': () => reportToken(null),
        'error-callback': () => reportToken(null),
      })
    }

    if (window.turnstile) {
      render()
    } else {
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
      if (!script) {
        script = document.createElement('script')
        script.id = SCRIPT_ID
        script.src = SCRIPT_SRC
        script.async = true
        document.head.append(script)
      }
      script.addEventListener('load', render)
    }

    return () => {
      cancelled = true
      document.getElementById(SCRIPT_ID)?.removeEventListener('load', render)
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [siteKey])

  return <div ref={container} />
}
