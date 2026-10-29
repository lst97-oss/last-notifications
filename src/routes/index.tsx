import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteNotFound } from '@/lib/site-not-found'

export const Route = createFileRoute('/')({
  component: Index,
  notFoundComponent: SiteNotFound,
})

function Index() {
  return (
    <div className="bg-background p-8 font-sans text-foreground">
      <h1>Payload + TanStack Start</h1>
      <p>
        <Link to="/admin">Go to Admin</Link>
      </p>
    </div>
  )
}
