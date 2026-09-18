import { z } from 'zod'

export const UserCredentialsSchema = z.strictObject({ email: z.email(), password: z.string() })

export type UserCredentialsDto = z.infer<typeof UserCredentialsSchema>
