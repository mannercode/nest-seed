import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { PresignUploadUrlDto, StorageFilesClient } from 'apps/infrastructures'
import { IsNotEmpty, IsString } from 'class-validator'
import { HttpRoutes } from 'shared'

class CompleteStorageFileBodyDto {
    @IsString()
    @IsNotEmpty()
    ownerService: string

    @IsString()
    @IsNotEmpty()
    ownerEntityId: string
}

@Controller(HttpRoutes.StorageFiles)
export class StorageFilesController {
    constructor(private storageFilesService: StorageFilesClient) {}

    @Post()
    presignUpload(@Body() body: PresignUploadUrlDto) {
        return this.storageFilesService.presignUploadUrl(body)
    }

    @Get(':fileId')
    async getDownloadInfo(@Param('fileId') fileId: string) {
        return this.storageFilesService.presignDownloadUrl(fileId)
    }

    @Post(':fileId/complete')
    @HttpCode(HttpStatus.OK)
    complete(@Param('fileId') fileId: string, @Body() body: CompleteStorageFileBodyDto) {
        return this.storageFilesService.complete(fileId, body)
    }

    @Delete(':fileId')
    async deleteFile(@Param('fileId') fileId: string) {
        return this.storageFilesService.deleteFiles([fileId])
    }
}
