import { z } from 'zod'

// `data.email` carries presentation only; anything else is dropped. Future themes
// are registered here by name, so a template never has to know about style keys.
const styleSchema = z.strictObject({
  theme: z.literal('default').default('default'),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour')
    .optional(),
})

export type EmailStyle = z.infer<typeof styleSchema>

export function parseEmailStyle(data: Record<string, unknown>): EmailStyle {
  const parsed = styleSchema.safeParse(data.email)
  return parsed.success ? parsed.data : { theme: 'default' }
}
