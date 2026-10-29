'use client'

// The email plugin's dashboard panel. It renders only what applies to email on
// top of the shared shell: how an address is resolved and the one-click
// unsubscribe the transport adds.
import { type ChannelPanelProps, ChannelPanelShell } from '@/components/dashboard/channels/shell'

export default function EmailChannelPanel({ appKey, channel }: ChannelPanelProps) {
  return (
    <ChannelPanelShell appKey={appKey} channel={channel}>
      <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
        <li>An address comes from the recipient's stored contact, or the publish request's one-shot override.</li>
        <li>Every message carries List-Unsubscribe, so one click opts the recipient out.</li>
        <li>Transport settings (provider, from, SMTP_PASS) live in the server plugin config, not here.</li>
      </ul>
    </ChannelPanelShell>
  )
}
