// Pages a person sees when they open an unsubscribe link in a browser. Values come from the link
// and the app's name, so every one is escaped before it goes into the markup.
const CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function page(title: string, body: string): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>
body { font-family: system-ui, sans-serif; max-width: 28rem; margin: 4rem auto; padding: 0 1rem; color: #111; }
button { font: inherit; padding: 0.6rem 1.1rem; border: 0; border-radius: 6px; background: #111; color: #fff; cursor: pointer; }
</style>
</head>
<body>
${body}
</body>
</html>
`
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': CSP,
    },
  })
}

// Asks before anything changes. The form posts to the same URL, so the signed proof travels with it.
export function unsubscribeConfirmPage(input: { appName: string; email: string }): Response {
  return page(
    'Unsubscribe from email',
    `<h1>Unsubscribe from email?</h1>
<p>You will stop receiving email notifications from ${escapeHtml(input.appName)} at <strong>${escapeHtml(input.email)}</strong>.</p>
<form method="post"><button type="submit">Unsubscribe</button></form>`,
  )
}

export function unsubscribedPage(input: { appName: string }): Response {
  return page(
    'Unsubscribed',
    `<h1>You are unsubscribed</h1>
<p>You will no longer get email notifications from ${escapeHtml(input.appName)}.</p>`,
  )
}
