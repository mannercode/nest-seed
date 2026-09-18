import { ChecksumSchema } from '@mannercode/common'
import { AssetDownloadSchema } from './asset-download.dto.js'
import { AssetOwnerSchema } from './asset-owner.dto.js'
import { z } from 'zod'

export const AssetSchema = z.strictObject({
    checksum: ChecksumSchema,
    download: AssetDownloadSchema.nullable(),
    id: z.string(),
    mimeType: z.string(),
    originalName: z.string(),
    owner: AssetOwnerSchema.nullable(),
    size: z.number()
})

export type AssetDto = z.infer<typeof AssetSchema>
