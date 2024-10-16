import { BadRequestException, NestInterceptor, Type } from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { generateUUID } from '../utils'

export type FilesInterceptorConfig = {
    fieldName: string
    directory: string
    allowedMimeTypes: string[]
    maxFileSizeBytes: number
    maxFilesPerUpload: number
}
export function createFilesInterceptor(
    config: () => FilesInterceptorConfig
): Type<NestInterceptor> {
    return FilesInterceptor(config().fieldName, undefined, {
        storage: diskStorage({
            destination: (_req, _file, cb) => cb(null, config().directory),
            filename: (_req, _file, cb) => cb(null, `${generateUUID()}.tmp`)
        }),
        fileFilter: (_req, file, cb) => {
            let error: Error | null = null

            if (!config().allowedMimeTypes.includes(file.mimetype)) {
                error = new BadRequestException(
                    `File type not allowed. Allowed types are: ${config().allowedMimeTypes.join(', ')}`
                )
            }

            cb(error, error === null)
        },
        limits: {
            fileSize: config().maxFileSizeBytes,
            files: config().maxFilesPerUpload
        }
    })
}
