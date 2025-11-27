import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator'
import { AttachmentDto } from './attachment.dto'

export class PresignDownloadUrlDto {
    @IsString()
    @IsNotEmpty()
    attachmentId: string

    @IsInt()
    @IsOptional()
    @Min(1)
    expiresInSec?: number
}

export type PresignDownloadUrlResponse = AttachmentDto
