import { Type } from 'class-transformer'
import { IsInt, IsNotEmpty, IsString, Min, ValidateNested } from 'class-validator'
import { Checksum } from 'common'

export class CreateAssetDto {
    @IsString()
    @IsNotEmpty()
    originalName: string

    @IsString()
    @IsNotEmpty()
    mimeType: string

    @IsInt()
    @Min(1)
    size: number


    @ValidateNested()
    @Type(() => Checksum)
    @IsNotEmpty()
    checksum: Checksum
}

export class UploadRequest {
    method: 'PUT'
    headers: Record<string, string>
    url: string
    expiresAt: Date
}

export class CreateAssetResponse {
    assetId: string
    uploadRequest: UploadRequest
}
