import { createFileRoute } from '@tanstack/react-router'
import { PayloadLayout, payloadLayout } from '@/payload/components/payload-layout'

export const Route = createFileRoute('/_payload')({
  ...payloadLayout,
  component: Object.assign(PayloadLayout, { preload: payloadLayout.component.preload }),
  head: () => ({
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  }),
})
