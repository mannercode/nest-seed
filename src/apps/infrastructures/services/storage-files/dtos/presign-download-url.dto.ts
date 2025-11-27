import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator'
import { StorageFileDto } from './storage-file.dto'

export class PresignDownloadUrlDto {
    @IsString()
    @IsNotEmpty()
    storageFileId: string

    @IsInt()
    @IsOptional()
    @Min(1)
    expiresInSec?: number
}

export type PresignDownloadUrlResponse = StorageFileDto
