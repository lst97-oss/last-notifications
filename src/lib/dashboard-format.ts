export const RANGES = ['7', '30', '90', 'all'] as const
export type Range = (typeof RANGES)[number]

export function isRange(value: string): value is Range {
  return (RANGES as readonly string[]).includes(value)
}

// `period` ends a title ("per day, last 30 days"); `within` opens a clause ("in the last 30 days").
export function rangeCopy(range: Range): { period: string; within: string } {
  if (range === 'all') return { period: 'all time', within: 'so far' }
  return { period: `last ${range} days`, within: `in the last ${range} days` }
}

export function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return day
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
