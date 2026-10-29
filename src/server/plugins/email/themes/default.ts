import type { EmailStyle } from '@/server/plugins/email/email.style'

export type EmailContent = {
  appName: string
  title: string
  body: string
  actionUrl?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Pure renderer: no I/O, no clock, so the output is testable in isolation. Table
// layout and inline styles are deliberate — mail clients strip <style> blocks.
export function renderDefaultTheme(content: EmailContent, style: EmailStyle): { html: string; text: string } {
  const accent = style.accentColor ?? '#111111'
  const paragraphs = content.body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  const bodyHtml = paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
  const action = content.actionUrl
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(content.actionUrl)}" style="background:${accent};color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Open</a></p>`
    : ''

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:8px;padding:28px">
<tr><td>
<p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#777777">${escapeHtml(content.appName)}</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escapeHtml(content.title)}</h1>
${bodyHtml}
${action}
</td></tr></table>
</td></tr></table>
</body></html>`

  const text = [
    `${content.appName}`,
    '',
    content.title,
    '',
    ...paragraphs,
    ...(content.actionUrl ? ['', content.actionUrl] : []),
  ].join('\n')
  return { html, text }
}
