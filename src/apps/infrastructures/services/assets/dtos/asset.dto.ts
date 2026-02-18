import { IsNotEmpty, IsString } from 'class-validator'
import { Checksum } from 'common'

export class AssetDownloadDto {
    expiresAt: Date
    url: string
}

export class AssetOwnerDto {
    @IsNotEmpty()
    @IsString()
    entityId: string

    @IsNotEmpty()
    @IsString()
    service: string
}

export class AssetDto {
    checksum: Checksum
    download: AssetDownloadDto | null
    id: string
    mimeType: string
    originalName: string
    owner: AssetOwnerDto | null
    size: number
}
