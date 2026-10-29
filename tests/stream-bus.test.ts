import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import type { NotificationRecord } from '@/server/modules/notifications/domain/notification'
import {
  type BusListener,
  startStreamBus,
  stopStreamBus,
} from '@/server/modules/notifications/infrastructure/stream-bus'
import { subscribeToRecipient } from '@/server/modules/notifications/infrastructure/stream-hub'

// Bun runs every test file in one process, so another file may already have started the bus.
beforeEach(async () => {
  await stopStreamBus()
})

afterEach(async () => {
  await stopStreamBus()
})

// A LISTEN fake: records the payload callback, and can fail the first attempt.
function fakeListener(failFirst: boolean) {
  let attempts = 0
  let onPayload: ((payload: string) => void) | null = null
  const listener: BusListener = {
    async listen(_channel, callback) {
      attempts += 1
      if (failFirst && attempts === 1) throw new Error('connection refused')
      onPayload = callback
      return { unlisten: async () => {} }
    },
  }
  return {
    listener,
    attempts: () => attempts,
    emit: (payload: string) => onPayload?.(payload),
  }
}

const record = (id: string): NotificationRecord => ({
  id,
  appId: 'app-1',
  recipientKey: 'someone',
  type: 't',
  title: 'T',
  body: '',
  data: {},
  priority: 0,
  dedupeKey: null,
  readAt: null,
  archivedAt: null,
  createdAt: '2026-10-28T00:00:00.000Z',
})

// A remote instance's NOTIFY arrives on the callback; the fan-out runs after a turn of the event loop.
const remoteNotify = (recipientKey: string, id: string) =>
  JSON.stringify({ p: 'other-instance', a: 'app-1', r: recipientKey, i: id })
const turn = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('startStreamBus', () => {
  test('tries LISTEN again after a failed attempt instead of keeping the failure', async () => {
    const fake = fakeListener(true)
    expect(await startStreamBus({ listener: fake.listener })).toBe(false)
    expect(await startStreamBus({ listener: fake.listener })).toBe(true)
    expect(fake.attempts()).toBe(2)
  })

  test('loads a remote row only when a local stream is waiting for that recipient', async () => {
    const fake = fakeListener(false)
    const loaded: string[] = []
    await startStreamBus({
      listener: fake.listener,
      loadNotification: async (id) => {
        loaded.push(id)
        return record(id)
      },
    })

    fake.emit(remoteNotify('nobody-here', 'n-1'))
    await turn()
    expect(loaded).toEqual([])

    const got: string[] = []
    const unsubscribe = subscribeToRecipient('app-1', 'someone', (next) => got.push(next.notification.id))
    fake.emit(remoteNotify('someone', 'n-2'))
    await turn()
    unsubscribe()
    expect(loaded).toEqual(['n-2'])
    expect(got).toEqual(['n-2'])
  })
})
