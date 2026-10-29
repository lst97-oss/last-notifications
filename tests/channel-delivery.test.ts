import { describe, expect, test } from 'bun:test'

import { getChannelRetryDelayMs } from '@/server/plugins/channel-delivery'

describe('getChannelRetryDelayMs', () => {
  test('doubles per attempt', () => {
    expect(getChannelRetryDelayMs(1)).toBe(1_000)
    expect(getChannelRetryDelayMs(2)).toBe(2_000)
    expect(getChannelRetryDelayMs(3)).toBe(4_000)
    expect(getChannelRetryDelayMs(5)).toBe(16_000)
  })

  test('caps at one hour', () => {
    expect(getChannelRetryDelayMs(12)).toBe(2_048_000)
    expect(getChannelRetryDelayMs(13)).toBe(3_600_000)
    expect(getChannelRetryDelayMs(40)).toBe(3_600_000)
  })

  test('treats attempt 0 as the first retry', () => {
    expect(getChannelRetryDelayMs(0)).toBe(1_000)
  })
})
