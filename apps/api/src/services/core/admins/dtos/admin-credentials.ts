import type { z } from 'zod'
import { CreateAdminSchema } from './create-admin.dto.js'

export const AdminCredentialsSchema = CreateAdminSchema.pick({ email: true, password: true })

export type AdminCredentialsDto = z.infer<typeof AdminCredentialsSchema>
