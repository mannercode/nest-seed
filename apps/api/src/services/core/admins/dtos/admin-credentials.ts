import { z } from 'zod'

export const AdminCredentialsSchema = z.strictObject({ email: z.email(), password: z.string() })

export type AdminCredentialsDto = z.infer<typeof AdminCredentialsSchema>
