import { z } from 'zod'
import { CreateUserSchema } from '#core'
import { CreateAssetSchema } from '#infrastructure'

export const RegisterUserSchema = CreateUserSchema.extend({
    photoAssetId: z.string().min(1).optional()
})
export type RegisterUserDto = z.infer<typeof RegisterUserSchema>

export const CreateRegistrationPhotoSchema = CreateAssetSchema.extend({
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    size: z
        .number()
        .int()
        .min(1)
        .max(5 * 1024 * 1024)
})
export type CreateRegistrationPhotoDto = z.infer<typeof CreateRegistrationPhotoSchema>
