import {
    Body,
    Controller,
    Delete,
    Get,
    Logger,
    Param,
    Post,
    StreamableFile,
    UploadedFiles,
    UseInterceptors
} from '@nestjs/common'
import { StreamableHandlerResponse } from '@nestjs/common/file-stream/interfaces'
import { FilesInterceptor } from '@nestjs/platform-express'
import { IsString } from 'class-validator'
import { STORAGE_FILES_ROUTE } from 'config'
import { createReadStream } from 'fs'
import { StorageFilesService } from 'services/storage-files'

class UploadFileDto {
    @IsString()
    name?: string
}

@Controller(STORAGE_FILES_ROUTE)
export class StorageFilesController {
    private logger: Logger

    constructor(private service: StorageFilesService) {
        this.logger = new Logger(StorageFilesController.name)
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
        stream.setErrorHandler((err: Error, _response: StreamableHandlerResponse) => {
            /* istanbul ignore next */
            this.logger.log(err.message, file)
        })

        return stream
    }

    @Delete(':fileId')
    async deleteStorageFile(@Param('fileId') fileId: string) {
        return this.service.deleteStorageFile(fileId)
    }
}
