import type { Checksum } from '@mannercode/nestlib-common'
import type { AssetDownloadDto } from './asset-download.dto'
import type { AssetOwnerDto } from './asset-owner.dto'

export class AssetDto {
    checksum: Checksum
    download: AssetDownloadDto | null
    id: string
    mimeType: string
    originalName: string
    owner: AssetOwnerDto | null
    size: number
}
