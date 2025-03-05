import { BadRequestException, Injectable } from '@nestjs/common'
import { MulterModuleOptions, MulterOptionsFactory } from '@nestjs/platform-express'
import { generateShortId } from 'common'
import { diskStorage } from 'multer'
import { AppConfigService } from 'shared/config'

// TODO 모듈 여기로 옮겨라
@Injectable()
export class MulterConfigService implements MulterOptionsFactory {
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
