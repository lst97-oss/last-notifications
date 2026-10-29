import { expect, test } from 'bun:test'
import { type AppRow, filterApps } from '@/routes/dashboard.apps'

const apps: AppRow[] = [
  { id: 'a', key: 'browser-created-93f3fec8', name: 'Browser Created', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'b', key: 'lastcomments-demo01', name: 'last-comments', createdAt: '2026-01-02T00:00:00.000Z' },
]

test('filterApps keeps every app for a blank query and matches name or key case-insensitively', () => {
  expect(filterApps(apps, '')).toEqual(apps)
  expect(filterApps(apps, '   ')).toEqual(apps)
  expect(filterApps(apps, 'COMMENTS').map((app) => app.id)).toEqual(['b'])
  expect(filterApps(apps, 'created-93').map((app) => app.id)).toEqual(['a'])
  expect(filterApps(apps, 'nope')).toEqual([])
})
