// A non-secret status line a channel plugin publishes for the dashboard. Values
// are operator-facing facts (provider, endpoint, "credentials set"); secrets are
// reported by presence only, never by value.
export type ChannelFact = { label: string; value: string }
