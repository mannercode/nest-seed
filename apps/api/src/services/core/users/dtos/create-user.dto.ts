import { PlainDateFromInputSchema } from '@mannercode/common'
import { z } from 'zod'

export const CreateUserSchema = z.strictObject({
    birthDate: PlainDateFromInputSchema,
    email: z.string().trim().toLowerCase().pipe(z.email()),
    name: z.string().min(1),
    password: z.string().refine((value) => {
        const length = [...value].length
        return 15 <= length && length <= 128
    }, 'Password must contain 15 to 128 Unicode code points.')
})

export type CreateUserDto = z.infer<typeof CreateUserSchema>
