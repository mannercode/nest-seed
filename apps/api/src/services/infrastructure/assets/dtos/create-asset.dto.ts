import { ChecksumSchema } from '@mannercode/common'
import { z } from 'zod'

export const CreateAssetSchema = z.strictObject({
    checksum: ChecksumSchema,
    mimeType: z.string().min(1),
    originalName: z.string().min(1),
    size: z.number().int().min(1)
})

export type CreateAssetDto = z.infer<typeof CreateAssetSchema>
