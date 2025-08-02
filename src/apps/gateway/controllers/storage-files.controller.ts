import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    StreamableFile,
    UploadedFiles,
    UseFilters,
    UseInterceptors
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { StorageFilesClient } from 'apps/infrastructures'
import { IsString } from 'class-validator'
import { createReadStream } from 'fs'
import { HttpRoutes } from 'shared'
import { MulterExceptionFilter } from './filters'

class UploadFileDto {
    @IsString()
    name?: string
}

@Controller(HttpRoutes.StorageFiles)
export class StorageFilesController {
    constructor(private storageFilesService: StorageFilesClient) {}

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

    @Delete(':fileId')
    async deleteFile(@Param('fileId') fileId: string) {
        return this.storageFilesService.deleteFiles([fileId])
    }
}
