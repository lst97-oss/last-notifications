import { Link } from '@tanstack/react-router'

// Site-level not-found boundary for unmatched public routes (distinct from the admin boundary).
export function SiteNotFound() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <p>
        <Link to="/">Go home</Link>
      </p>
    </div>
  )
}
