import { ErrorCode } from '@/server/http/errors'

// Renders the error reference from the table the routes answer with, so the docs
// cannot drift from the codes or the statuses they carry.
export function ErrorTable() {
  return (
    <table>
      <thead>
        <tr>
          <th>Code</th>
          <th>Status</th>
          <th>Meaning</th>
        </tr>
      </thead>
      <tbody>
        {Object.values(ErrorCode).map((error) => (
          <tr key={error.code}>
            <td>
              <code>{error.code}</code>
            </td>
            <td>{error.status}</td>
            <td>{error.message}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
