import { z } from 'zod'

export const AdminSchema = z.strictObject({ email: z.string(), id: z.string(), name: z.string() })

export type AdminDto = z.infer<typeof AdminSchema>
