import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Query,
    StreamableFile,
    UploadedFiles,
    UseFilters,
    UseInterceptors
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { PresignUploadUrlDto, StorageFilesClient } from 'apps/infrastructures'
import { IsNotEmpty, IsString } from 'class-validator'
import { createReadStream } from 'fs'
import { HttpRoutes } from 'shared'
import { MulterExceptionFilter } from './filters'

class UploadFileDto {
    @IsString()
    name?: string
}

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

    @Post('presign-upload')
    presignUpload(@Body() body: PresignUploadUrlDto) {
        return this.storageFilesService.presignUploadUrl(body)
    }

    @UseFilters(new MulterExceptionFilter())
    @UseInterceptors(FilesInterceptor('files'))
    @Post()
    async saveFiles(@UploadedFiles() files: Express.Multer.File[], @Body() _body: UploadFileDto) {
        const createFileDtos = files.map((file) => ({
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            path: file.path
        }))

        const storageFiles = await this.storageFilesService.saveFiles(createFileDtos)
        return { storageFiles }
    }

    @Get(':fileId/presign-download')
    presignDownload(@Param('fileId') fileId: string, @Query('expiresInSec') expires?: string) {
        const parsedExpiresInSec = expires ? parseInt(expires, 10) : undefined
        const expiresInSec = Number.isNaN(parsedExpiresInSec) ? undefined : parsedExpiresInSec

        return this.storageFilesService.presignDownloadUrl(fileId, expiresInSec)
    }

    @Get(':fileId')
    async downloadFile(@Param('fileId') fileId: string) {
        const files = await this.storageFilesService.getFiles([fileId])
        const file = files[0]

        // TODO 스트림으로 전달하도록 변경해야 한다. storedPath는 지워야 한다.
        const readStream = createReadStream(file.storedPath)

        const stream = new StreamableFile(readStream, {
            type: file.mimeType,
            disposition: `attachment; filename="${encodeURIComponent(file.originalName)}"`,
            length: file.size
        })

        return stream
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
