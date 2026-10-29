import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

test('centres the checked radio dot inside the available inner area', () => {
  const html = renderToStaticMarkup(
    <RadioGroup defaultValue="email" aria-label="Delivery">
      <RadioGroupItem value="email" aria-label="Email" />
      <RadioGroupItem value="app" aria-label="In app" />
    </RadioGroup>,
  )
  const indicator = html.match(/data-slot="radio-group-indicator" class="([^"]+)"/)
  expect(indicator?.[1]?.split(' ').includes('size-full')).toBe(true)
  expect((html.match(/data-slot="radio-group-indicator"/g) ?? []).length).toBe(1)
  expect(html.includes('absolute top-1/2 left-1/2')).toBe(false)
  expect(html.includes('aria-checked="true"')).toBe(true)
  expect(html.includes('aria-checked="false"')).toBe(true)
})
