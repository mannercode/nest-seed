import { InstantFromInputSchema } from '@mannercode/common'
import { z } from 'zod'

export const AssetDownloadSchema = z.strictObject({
    expiresAt: InstantFromInputSchema,
    url: z.string()
})

export type AssetDownloadDto = z.infer<typeof AssetDownloadSchema>
