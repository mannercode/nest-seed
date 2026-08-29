import type { Checksum } from '@mannercode/common'
import type { AssetDownloadDto } from './asset-download.dto.js'
import type { AssetOwnerDto } from './asset-owner.dto.js'

export class AssetDto {
    checksum: Checksum
    download: AssetDownloadDto | null
    id: string
    mimeType: string
    originalName: string
    owner: AssetOwnerDto | null
    size: number
}
