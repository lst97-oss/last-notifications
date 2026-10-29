import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useFumadocsLoader } from 'fumadocs-core/source/client'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import { RootProvider } from 'fumadocs-ui/provider/tanstack'
import { Suspense, use } from 'react'

import { getMDXComponents } from '@/components/docs/mdx-components'
import { baseOptions } from '@/lib/docs/layout-shared'
import { serializeDocsPageTree } from '@/lib/docs/page-tree'
import { docs, source } from '@/lib/docs/source'
import '@/styles/docs.css'

export const Route = createFileRoute('/docs/$')({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split('/') ?? []
    const data = await serverLoader({ data: slugs })
    await docs.getPage(data.path)?.preload()
    return data
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} · Last Notifications` },
          { name: 'description', content: loaderData.description },
        ]
      : [{ title: 'Docs · Last Notifications' }],
  }),
})

// Hoisted so the MDX component map and the layout options keep a stable
// identity across renders.
const MDX_COMPONENTS = getMDXComponents()
const DOCS_LAYOUT_OPTIONS = baseOptions()

const serverLoader = createServerFn({ method: 'GET' })
  .validator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs)
    if (!page) throw notFound()
    return {
      path: page.path,
      title: page.data.title,
      description: page.data.description ?? '',
      pageTree: serializeDocsPageTree(source.pageTree),
    }
  })

function Content({ path }: { path: string }) {
  const page = docs.getPage(path)
  if (!page) throw new Error(`unknown page: ${path}`)

  const { toc } = use(page.load())
  const MDX = page.body

  return (
    <DocsPage toc={toc}>
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <DocsBody>
        <MDX components={MDX_COMPONENTS} />
      </DocsBody>
    </DocsPage>
  )
}

function Page() {
  const { path, pageTree } = useFumadocsLoader(Route.useLoaderData())

  // The provider lives here, beside the layout that needs it: Fumadocs' tree, links and footer all read its
  // framework context, and a provider chosen in the root shell can be missing during client navigation.
  // next-themes owns `.dark`, so Fumadocs' own theming stays off.
  return (
    <RootProvider theme={{ enabled: false }}>
      <DocsLayout {...DOCS_LAYOUT_OPTIONS} tree={pageTree}>
        <Suspense>
          <Content path={path} />
        </Suspense>
      </DocsLayout>
    </RootProvider>
  )
}
