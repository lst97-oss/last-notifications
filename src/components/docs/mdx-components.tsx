import { Accordion, Accordions } from 'fumadocs-ui/components/accordion'
import { Callout } from 'fumadocs-ui/components/callout'
import { Card, type CardProps, Cards } from 'fumadocs-ui/components/card'
import { Step, Steps } from 'fumadocs-ui/components/steps'
import { Tab, Tabs } from 'fumadocs-ui/components/tabs'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import type { MDXComponents } from 'mdx/types'
import type { ReactNode } from 'react'
import { ErrorTable } from '@/components/docs/error-table'

export type DocsMdxComponents = MDXComponents & {
  Callout: typeof Callout
  Card: typeof DocsCard
  Cards: typeof Cards
  Tab: typeof Tab
  Tabs: typeof Tabs
  Step: typeof Step
  Steps: typeof Steps
  Accordion: typeof Accordion
  Accordions: typeof Accordions
  ErrorTable: typeof ErrorTable
}

const DefaultLink = defaultMdxComponents.a

// Fumadocs renders markdown links as router links, but the API routes are
// server-only: they have no client component, so a router navigation lands on
// the not-found page while a document load serves the endpoint. Links to
// `/api/*` therefore stay plain anchors.
function MdxLink({ href, children, ...props }: { href?: string; children?: ReactNode }) {
  if (typeof href === 'string' && href.startsWith('/api/')) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }
  return (
    <DefaultLink href={href} {...props}>
      {children}
    </DefaultLink>
  )
}

// A card to `/api/*` needs the same plain anchor: Fumadocs' Card navigates through the router otherwise.
function DocsCard({ href, ...props }: CardProps) {
  if (typeof href === 'string' && href.startsWith('/api/')) {
    return (
      <a href={href} className="block no-underline text-fd-foreground">
        <Card {...props} />
      </a>
    )
  }
  return <Card href={href} {...props} />
}

export function getMDXComponents(components?: MDXComponents): DocsMdxComponents {
  return {
    ...defaultMdxComponents,
    Callout,
    Card: DocsCard,
    Cards,
    Tab,
    Tabs,
    Step,
    Steps,
    Accordion,
    Accordions,
    ErrorTable,
    a: MdxLink,
    ...components,
  } as DocsMdxComponents
}

export const useMDXComponents = getMDXComponents

declare global {
  type MDXProvidedComponents = DocsMdxComponents
}
