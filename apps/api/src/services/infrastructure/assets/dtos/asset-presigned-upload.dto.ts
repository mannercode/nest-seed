import { InstantFromInputSchema } from '@mannercode/common'
import { z } from 'zod'

export const AssetPresignedUploadSchema = z.strictObject({
    assetId: z.string(),
    expiresAt: InstantFromInputSchema,
    fields: z.record(z.string(), z.string()),
    method: z.literal('POST'),
    url: z.string()
})

export type AssetPresignedUploadDto = z.infer<typeof AssetPresignedUploadSchema>
