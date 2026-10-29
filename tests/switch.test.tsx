import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Switch } from '@/components/ui/switch'

test('switch track scales with its thumb and retains checked semantics', () => {
  for (const size of ['default', 'sm'] as const) {
    for (const checked of [true, false]) {
      const html = renderToStaticMarkup(<Switch size={size} checked={checked} aria-label="Updates" />)
      expect(html).toContain(`aria-checked="${checked}"`)
      expect(html).toContain(checked ? 'data-checked=""' : 'data-unchecked=""')
      expect(html).toContain(size === 'default' ? 'data-[size=default]:w-8' : 'data-[size=sm]:w-6')
      expect(html).not.toMatch(/data-\[size=[^\]]+\]:[hw]-\[[\d.]+px\]/)
    }
  }
})
