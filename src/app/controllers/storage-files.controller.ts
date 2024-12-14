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
import { Routes } from 'config'
import { createReadStream } from 'fs'
import { pick } from 'lodash'
import { StorageFilesService } from 'services/infrastructures'

class UploadFileDto {
    @IsString()
    name?: string
}

@Controller(Routes.StorageFiles)
export class StorageFilesController {
    private logger: Logger

    constructor(private service: StorageFilesService) {
        this.logger = new Logger(StorageFilesController.name)
    }

    @UseInterceptors(FilesInterceptor('files'))
    @Post()
    async saveFiles(@UploadedFiles() files: Express.Multer.File[], @Body() _body: UploadFileDto) {
        const createDtos = files.map((file) =>
            pick(file, 'originalname', 'mimetype', 'size', 'path')
        )

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
