import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator'

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

    @IsString()
    @IsNotEmpty()
    checksum: string
}

export type CreateAssetResponse = {
    assetId: string
    uploadUrl: string
    expiresAt: Date
    method: 'PUT'
    headers: Record<string, string>
}
