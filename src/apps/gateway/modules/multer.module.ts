import { BadRequestException, Injectable, Module } from '@nestjs/common'
import {
    MulterModuleOptions,
    MulterOptionsFactory,
    MulterModule as NestMulterModule
} from '@nestjs/platform-express'
import { generateShortId } from 'common'
import { GatewayConfigService } from 'gateway/config'
import { diskStorage } from 'multer'

@Injectable()
export class MulterConfigService implements MulterOptionsFactory {
    constructor(private config: GatewayConfigService) {}

    createMulterOptions(): MulterModuleOptions {
        return {
            storage: diskStorage({
                destination: (_req, _file, cb) => cb(null, this.config.fileUpload.directory),
                filename: (_req, _file, cb) => cb(null, `${generateShortId()}.tmp`)
            }),
            fileFilter: (_req, file, cb) => {
                let error: Error | null = null

                if (!this.config.fileUpload.allowedMimeTypes.includes(file.mimetype)) {
                    error = new BadRequestException({
                        code: 'ERR_INVALID_FILE_TYPE',
                        message: 'File type not allowed.',
                        allowedTypes: this.config.fileUpload.allowedMimeTypes
                    })
                }

                cb(error, error === null)
            },
            limits: {
                fileSize: this.config.fileUpload.maxFileSizeBytes,
                files: this.config.fileUpload.maxFilesPerUpload
            }
        }
    }
}

@Module({
    imports: [NestMulterModule.registerAsync({ useClass: MulterConfigService })],
    exports: [NestMulterModule]
})
export class MulterModule {}
