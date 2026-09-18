import { z } from 'zod'

export const CreateAdminSchema = z.strictObject({
    email: z.email(),
    name: z.string().min(1),
    password: z.string().min(1)
})

export type CreateAdminDto = z.infer<typeof CreateAdminSchema>
