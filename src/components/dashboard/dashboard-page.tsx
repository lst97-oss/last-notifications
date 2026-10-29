'use client'

import { cn } from 'cn'

// Page frame for every dashboard route: an eyebrow, the title, one sentence of
// intent, and the page's primary actions on the right — the same shape as the
// admin pages, so the three screens read as one product.
export function DashboardPage({
  eyebrow,
  title,
  description,
  actions,
  width = 'narrow',
  children,
}: {
  eyebrow: string
  title: string
  description: string
  actions?: React.ReactNode
  // Chart pages need the reference dashboard's three-column room.
  width?: 'narrow' | 'wide'
  children: React.ReactNode
}) {
  return (
    <main className={cn('mx-auto grid w-full gap-6 text-foreground', width === 'wide' ? 'max-w-6xl' : 'max-w-3xl')}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{eyebrow}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      {children}
    </main>
  )
}
