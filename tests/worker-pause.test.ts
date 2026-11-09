import { describe, expect, test } from 'bun:test'

import { IDLE_MS, nextPauseMs } from '@/server/plugins/worker-pause'

describe('nextPauseMs', () => {
  test('a full batch runs again at once, a short pass waits, and failures back off to a minute', () => {
    expect(nextPauseMs({ hasChannels: true, batchWasFull: true, failures: 0 })).toBe(0)
    expect(nextPauseMs({ hasChannels: true, batchWasFull: false, failures: 0 })).toBe(1_000)
    expect(nextPauseMs({ hasChannels: false, batchWasFull: false, failures: 0 })).toBe(IDLE_MS)
    expect(nextPauseMs({ hasChannels: true, batchWasFull: true, failures: 1 })).toBe(2_000)
    expect(nextPauseMs({ hasChannels: true, batchWasFull: false, failures: 2 })).toBe(4_000)
    expect(nextPauseMs({ hasChannels: true, batchWasFull: false, failures: 50 })).toBe(60_000)
  })
})
