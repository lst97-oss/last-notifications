'use client'

import * as React from 'react'

import { loadHighlighter } from '@/lib/highlighter'

type Loaded = Awaited<ReturnType<typeof loadHighlighter>>

// One load per language, shared by every block. A failed load is dropped, so the next mount tries again.
const loads = new Map<string, Promise<Loaded>>()

function highlighterFor(language: string): Promise<Loaded> {
  let load = loads.get(language)
  if (!load) {
    load = loadHighlighter(language).catch((error: unknown) => {
      loads.delete(language)
      throw error
    })
    loads.set(language, load)
  }
  return load
}

// `use()` suspends until the grammar is loaded, so callers wrap the component in a <Suspense>
// whose fallback is the plain code. A failed load reaches the nearest error boundary.
export function useHighlightedCode(value: string, language: string) {
  // A trailing newline would render as an extra empty line.
  const code = value.endsWith('\n') ? value.slice(0, -1) : value
  const highlighter = React.use(highlighterFor(language))

  // The complete lines, highlighted. While the code streams, only the new
  // lines are tokenized, starting from the grammar state of the last one.
  const [done, setDone] = React.useState<{
    highlighter: typeof highlighter
    text: string
    lines: React.ReactNode[]
    state?: Parameters<NonNullable<typeof highlighter>['highlight']>[1]
  }>({ highlighter: null, text: '', lines: [] })

  let next = done

  if (next.highlighter !== highlighter || !code.startsWith(next.text)) {
    next = { highlighter, text: '', lines: [] }
  }

  const end = code.lastIndexOf('\n') + 1

  if (highlighter && end > next.text.length) {
    const result = highlighter.highlight(code.slice(next.text.length, end - 1), next.state)

    next = {
      highlighter,
      text: code.slice(0, end),
      lines: [...next.lines, ...result.lines],
      state: result.state,
    }
  }

  if (next !== done) {
    setDone(next)
  }

  // The last line is still being written, so it is tokenized on every render.
  const tail = code.slice(end)

  return React.useMemo(() => {
    if (!highlighter) {
      return code.split('\n')
    }

    return [...next.lines, highlighter.highlight(tail, next.state).lines[0]]
  }, [code, highlighter, next, tail])
}
