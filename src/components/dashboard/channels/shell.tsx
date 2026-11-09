'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { describeApiError, readApiData } from '@/lib/api-response'
import type { ChannelFact } from '@/lib/channel-facts'

// What the channels endpoint returns for one app. `enabled` is the per-app switch;
// `installed`/`detail`/`facts` come from the plugin's own describe().
export type ChannelPanelProps = { appKey: string; channel: ChannelView }

export type ChannelView = {
  channel: string
  installed: boolean
  detail: string
  enabled: boolean
  config: Record<string, unknown>
  facts: ChannelFact[]
}

const CHANNEL_LABELS: Record<string, string> = {
  inapp: 'In-app',
  email: 'Email',
  webpush: 'Web push',
  webhook: 'Webhook',
}

export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel.charAt(0).toUpperCase() + channel.slice(1)
}

// The one piece of chrome every plugin panel shares: title, plugin detail, the
// per-app switch, and the plugin's non-secret facts. A panel only adds the body.
export function ChannelPanelShell({
  appKey,
  channel,
  children,
}: {
  appKey: string
  channel: ChannelView
  children?: ReactNode
}) {
  const queryClient = useQueryClient()

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const response = await fetch(`/api/v1/admin/apps/${encodeURIComponent(appKey)}/channels`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel: channel.channel, enabled: next }),
      })
      return readApiData<{ enabled: boolean }>(response)
    },
    // Awaited, so the switch keeps showing the saved value until the refetch brings the server's copy.
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-app-channels', appKey] })
    },
  })

  const error = toggle.error ? describeApiError(toggle.error, 'Could not update the channel') : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{channelLabel(channel.channel)}</CardTitle>
        <CardDescription>{channel.detail}</CardDescription>
        <CardAction>
          <Switch
            aria-label={`Enable ${channelLabel(channel.channel)}`}
            checked={toggle.isPending ? toggle.variables : channel.enabled}
            disabled={!channel.installed || toggle.isPending}
            onCheckedChange={(next) => toggle.mutate(next)}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-2 text-sm">
          {channel.facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="min-w-0 truncate text-right font-mono text-xs" title={fact.value}>
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
        {!channel.installed ? (
          <p className="text-xs text-muted-foreground">
            This channel is not configured on the server, so the switch stays off.
          </p>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}
        {children}
      </CardContent>
    </Card>
  )
}
