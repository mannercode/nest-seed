import { ChecksumSchema } from '@mannercode/common'
import { z } from 'zod'

const integerFromInput = z
    .union([z.number(), z.string(), z.boolean()])
    .transform(Number)
    .pipe(z.number().int())
const requiredString = z
    .union([z.string(), z.number(), z.boolean()])
    .transform(String)
    .pipe(z.string().min(1))

export const CreateAssetSchema = z.strictObject({
    checksum: ChecksumSchema,
    mimeType: requiredString,
    originalName: requiredString,
    size: integerFromInput.pipe(z.number().min(1))
})

export type CreateAssetDto = z.infer<typeof CreateAssetSchema>
