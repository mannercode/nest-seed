import { IsNotEmpty, IsString } from 'class-validator'
import { Checksum } from 'common'

export class AssetOwnerDto {
    @IsString()
    @IsNotEmpty()
    service: string

    @IsString()
    @IsNotEmpty()
    entityId: string
}

export class AssetDownloadDto {
    url: string
    expiresAt: Date
}

export class AssetDto {
    id: string
    originalName: string
    mimeType: string
    size: number
    checksum: Checksum
    owner: AssetOwnerDto | null
    download: AssetDownloadDto | null
}
