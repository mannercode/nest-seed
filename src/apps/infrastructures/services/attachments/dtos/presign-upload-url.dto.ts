import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator'
import { AttachmentDto } from './attachment.dto'

export class PresignUploadUrlDto {
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

    @IsInt()
    @IsOptional()
    @Min(1)
    expiresInSec?: number
}

export type PresignUploadUrlResponse = {
    attachmentId: string
    uploadUrl: string
    expiresAt: Date
    method: 'PUT'
    headers: Record<string, string>
    attachment: AttachmentDto
}
