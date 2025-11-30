import { Checksum } from 'common'

export class AssetDto {
    id: string
    originalName: string
    mimeType: string
    size: number
    checksum: Checksum
    owner: { service: string; entityId: string } | null
    download: { url: string; expiresAt: Date } | null
}
