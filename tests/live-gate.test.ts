import { describe, expect, test } from 'bun:test'

import { createLiveGate } from '@/server/modules/notifications/http/live-gate'
import type { StreamEvent } from '@/server/modules/notifications/infrastructure/stream-hub'

const event = (id: string): StreamEvent => ({
  cursor: `cursor-${id}`,
  notification: { id } as StreamEvent['notification'],
})

describe('createLiveGate', () => {
  test('holds a live event that arrives during the backlog, and sends it after the backlog', () => {
    const sent: string[] = []
    const gate = createLiveGate((next) => sent.push(next.notification.id))
    gate.live(event('late'))
    gate.backlog(event('old-1'))
    gate.backlog(event('old-2'))
    expect(sent).toEqual(['old-1', 'old-2'])
    gate.open()
    expect(sent).toEqual(['old-1', 'old-2', 'late'])
  })

  test('sends a held event only once when the backlog already carried it', () => {
    const sent: string[] = []
    const gate = createLiveGate((next) => sent.push(next.notification.id))
    gate.live(event('shared'))
    gate.backlog(event('shared'))
    gate.open()
    expect(sent).toEqual(['shared'])
  })

  test('sends live events straight through once the stream is open', () => {
    const sent: string[] = []
    const gate = createLiveGate((next) => sent.push(next.notification.id))
    gate.open()
    gate.live(event('now'))
    expect(sent).toEqual(['now'])
  })
})
