import { BadRequestException, Injectable, Module } from '@nestjs/common'
import { MulterOptionsFactory, MulterModule as NestMulterModule } from '@nestjs/platform-express'
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface'
import { generateShortId } from 'common'
import { AppConfigService } from 'config'
import { diskStorage } from 'multer'

@Injectable()
export class MulterConfigService implements MulterOptionsFactory {
    constructor(private config: AppConfigService) {}

    createMulterOptions(): MulterOptions {
        return {
            storage: diskStorage({
                destination: (_req, _file, cb) => cb(null, this.config.fileUpload.directory),
                filename: (_req, _file, cb) => cb(null, `${generateShortId()}.tmp`)
            }),
            fileFilter: (_req, file, cb) => {
                let error: Error | null = null

                if (!this.config.fileUpload.allowedMimeTypes.includes(file.mimetype)) {
                    error = new BadRequestException(
                        `File type not allowed. Allowed types are: ${this.config.fileUpload.allowedMimeTypes.join(', ')}`
                    )
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
    imports: [
        NestMulterModule.registerAsync({
            useClass: MulterConfigService
        })
    ],
    exports: [NestMulterModule]
})
export class MulterModule {}
