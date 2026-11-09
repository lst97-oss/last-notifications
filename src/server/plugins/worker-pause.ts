// How long the channel worker sleeps between passes. Kept out of the worker script so the retry policy can be tested.
export const IDLE_MS = 2 ** 31 - 1 // setTimeout's maximum delay
const BUSY_MS = 1_000
const MAX_BACKOFF_MS = 60_000

// A full batch means more is due, so the next pass starts now. A short pass waits. Each failed pass waits twice
// as long as the one before, up to a minute, so an outage logs once per step, not once per second.
export function nextPauseMs(pass: { hasChannels: boolean; batchWasFull: boolean; failures: number }): number {
  if (pass.failures > 0) return Math.min(BUSY_MS * 2 ** pass.failures, MAX_BACKOFF_MS)
  if (pass.batchWasFull) return 0
  return pass.hasChannels ? BUSY_MS : IDLE_MS
}
