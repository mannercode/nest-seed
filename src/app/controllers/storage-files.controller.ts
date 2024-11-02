import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    StreamableFile,
    UploadedFiles,
    UseInterceptors
} from '@nestjs/common'
import { StreamableHandlerResponse } from '@nestjs/common/file-stream/interfaces'
import { FilesInterceptor } from '@nestjs/platform-express'
import { IsString } from 'class-validator'
import { createReadStream } from 'fs'
import { StorageFilesService } from 'services/storage-files'

class UploadFileDto {
    @IsString()
    name?: string
}

@Controller('storage-files')
export class StorageFilesController {
    constructor(private service: StorageFilesService) {}

    async onModuleDestroy() {
        console.log('StorageFilesController.onModuleDestroy()')
    }

    @UseInterceptors(FilesInterceptor('files'))
    @Post()
    async saveFiles(@UploadedFiles() files: Express.Multer.File[], @Body() _body: UploadFileDto) {
        const createDtos = files.map((file) => ({
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadedFilePath: file.path
        }))

        const storageFiles = await this.service.saveFiles(createDtos)
        return { storageFiles }
    }

    @Get(':fileId')
    async downloadFile(@Param('fileId') fileId: string) {
        const file = await this.service.getStorageFile(fileId)

        const readStream = createReadStream(file.storedPath)

        const stream = new StreamableFile(readStream, {
            type: file.mimetype,
            disposition: `attachment; filename="${encodeURIComponent(file.originalname)}"`,
            length: file.size
        })

        /* istanbul ignore next */
        stream.setErrorHandler((err: Error, response: StreamableHandlerResponse) => {
            /* istanbul ignore next */
            console.log('------stream.setErrorHandler-----', err, file)
        })

        return stream
    }

    @Delete(':fileId')
    async deleteStorageFile(@Param('fileId') fileId: string) {
        return this.service.deleteStorageFile(fileId)
    }
}
