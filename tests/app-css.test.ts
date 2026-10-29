import { expect, test } from 'bun:test'

test('registers Tailwind base before utilities when importing granular stylesheets', async () => {
  const css = (await Bun.file('src/styles/app.css').text()).replace(/\/\*[\s\S]*?\*\//g, '')
  const order = css.match(/@layer\s+([^;{]+);/)
  expect(order?.[1]?.split(',').map((layer) => layer.trim())).toEqual(['theme', 'base', 'components', 'utilities'])
  expect(order?.index).toBeLessThan(css.indexOf('@import'))
})

test('scopes generated utilities to public documents to avoid Payload class collisions', async () => {
  const css = await Bun.file('src/styles/app.css').text()
  expect(css).toMatch(/@scope\s*\(html\[data-public-ui\]\)\s*\{\s*@tailwind utilities;/)
  expect(css).not.toMatch(/@import\s+["']tailwindcss\/utilities\.css["']/)
})
