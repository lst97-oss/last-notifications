import { z } from 'zod'

import { ErrorCode, HttpError } from '@/server/http/errors'

// Shared zod → 400 mapper so every module reports validation failures the
// same way: HttpError(ErrorCode.VALIDATION_ERROR, '<path>: <message>; …').
// Throwing (not returning) keeps use cases free of result-union plumbing —
// withContext maps it to { error: { code, message } } with status 400.
export function parseWith<T>(schema: z.ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new HttpError(ErrorCode.VALIDATION_ERROR, fromZodIssues(error.issues))
    }
    throw error
  }
}

// Largest JSON body a route reads unless it names a bigger one. The limit is enforced before
// the body is buffered, so an oversized request never fills memory.
export const JSON_BODY_MAX_BYTES = 64 * 1024

// Parse a JSON request body against a schema: an oversized body is 413 BODY_TOO_LARGE, malformed
// JSON is 400 MALFORMED_JSON; schema failures go through parseWith (400 VALIDATION_ERROR).
// Use in POST/PATCH/PUT handlers.
export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = JSON_BODY_MAX_BYTES,
): Promise<T> {
  const declared = request.headers.get('content-length')
  if (declared !== null && Number(declared) > maxBytes) throw new HttpError(ErrorCode.BODY_TOO_LARGE)
  const text = new TextDecoder().decode(await readAtMost(request, maxBytes))
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new HttpError(ErrorCode.MALFORMED_JSON)
  }
  return parseWith(schema, json)
}

// Reads the body stream and stops as soon as it passes the limit. Chunked bodies have no
// Content-Length, so the count is the only guard for them.
async function readAtMost(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new HttpError(ErrorCode.BODY_TOO_LARGE)
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

// Parse URL query params against a schema: pass request.url and get a typed
// object. Expects a z.object of coercible fields (z.coerce.number() etc.)
// since every value arrives as a string. Use in GET list/filter handlers.
export function parseSearchParams<T>(url: string, schema: z.ZodType<T>): T {
  let params: URLSearchParams
  try {
    params = new URL(url).searchParams
  } catch {
    throw new HttpError(ErrorCode.VALIDATION_ERROR, 'url: request URL is not valid')
  }
  return parseWith(schema, Object.fromEntries(params))
}

// Shared pagination query: every list endpoint takes the same ?limit=&offset=.
// Defaults limit 20, caps at 100 so a missing param can never trigger an
// unbounded read. Out-of-range values are 400 VALIDATION_ERROR (client
// bug), not silent clamping.
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export type Pagination = z.infer<typeof paginationQuerySchema>

export function parsePaginationParams(url: string): Pagination {
  return parseSearchParams(url, paginationQuerySchema)
}

function fromZodIssues(issues: z.ZodError['issues']): string {
  if (issues.length === 0) return 'invalid input'
  return issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'value'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}
