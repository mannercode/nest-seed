import { BadRequestException, Injectable, Module } from '@nestjs/common'
import { MulterModule, MulterModuleOptions, MulterOptionsFactory } from '@nestjs/platform-express'
import { generateShortId } from 'common'
import { GatewayErrors } from 'gateway/gateway-errors'
import { diskStorage } from 'multer'
import { AppConfigService } from 'shared/config'

@Injectable()
class MulterConfigService implements MulterOptionsFactory {
    constructor(private config: AppConfigService) {}

    createMulterOptions(): MulterModuleOptions {
        const tempFileLength = 20

        return {
            storage: diskStorage({
                destination: (_req, _file, cb) => cb(null, this.config.fileUpload.directory),
                filename: (_req, _file, cb) => cb(null, `${generateShortId(tempFileLength)}.tmp`)
            }),
            fileFilter: (_req, file, cb) => {
                let error: Error | null = null

                if (!this.config.fileUpload.allowedMimeTypes.includes(file.mimetype)) {
                    error = new BadRequestException({
                        ...GatewayErrors.InvalidFileType,
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
    imports: [MulterModule.registerAsync({ useClass: MulterConfigService })],
    exports: [MulterModule]
})
export class MulterConfigModule {}
