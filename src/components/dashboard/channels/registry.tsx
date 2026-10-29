'use client'

// A plugin that wants a bespoke dashboard panel ships `<id>.panel.tsx` inside its
// own folder and registers it here with a lazy import, so server-only plugin code
// (nodemailer, web-push, env reads) never reaches the client bundle. Anything not
// registered falls back to the generic shell.
import { type ComponentType, lazy, Suspense } from 'react'
import { type ChannelPanelProps, ChannelPanelShell } from '@/components/dashboard/channels/shell'
import { Skeleton } from '@/components/ui/skeleton'

const EmailChannelPanel = lazy(() => import('@/server/plugins/email/email.panel'))

const CHANNEL_PANELS: Record<string, ComponentType<ChannelPanelProps>> = {
  email: EmailChannelPanel,
}

export function ChannelPanel({ appKey, channel }: ChannelPanelProps) {
  const Panel = CHANNEL_PANELS[channel.channel]
  if (!Panel) return <ChannelPanelShell appKey={appKey} channel={channel} />
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
      <Panel appKey={appKey} channel={channel} />
    </Suspense>
  )
}
