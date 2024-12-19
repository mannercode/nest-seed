import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { BaseConfigService } from 'common'
import Joi from 'joi'

export const configSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
    HTTP_REQUEST_PAYLOAD_LIMIT: Joi.string().required(),
    HTTP_PAGINATION_DEFAULT_SIZE: Joi.number().required(),
    AUTH_ACCESS_SECRET: Joi.string().required(),
    LOG_DIRECTORY: Joi.string().required(),
    LOG_DAYS_TO_KEEP: Joi.string().required(),
    LOG_FILE_LEVEL: Joi.string().required(),
    LOG_CONSOLE_LEVEL: Joi.string().required(),
    FILE_UPLOAD_DIRECTORY: Joi.string().required(),
    FILE_UPLOAD_MAX_FILE_SIZE_BYTES: Joi.number().required(),
    FILE_UPLOAD_MAX_FILES_PER_UPLOAD: Joi.number().required(),
    FILE_UPLOAD_ALLOWED_FILE_TYPES: Joi.string().required(),
    APPLICATIONS_CLIENT_PORT: Joi.number().required(),
    CORES_CLIENT_PORT: Joi.number().required(),
    INFRASTRUCTURES_CLIENT_PORT: Joi.number().required()
})

@Injectable()
export class GatewayConfigService extends BaseConfigService {
    constructor(configService: ConfigService<object, true>) {
        super(configService, configSchema)
    }

    get http() {
        return {
            requestPayloadLimit: this.getString('HTTP_REQUEST_PAYLOAD_LIMIT'),
            paginationDefaultSize: this.getNumber('HTTP_PAGINATION_DEFAULT_SIZE')
        }
    }
    get auth() {
        return {
            accessSecret: this.getString('AUTH_ACCESS_SECRET')
        }
    }
    get log() {
        return {
            directory: this.getString('LOG_DIRECTORY'),
            daysToKeepLogs: this.getString('LOG_DAYS_TO_KEEP'),
            fileLogLevel: this.getString('LOG_FILE_LEVEL'),
            consoleLogLevel: this.getString('LOG_CONSOLE_LEVEL')
        }
    }

    get fileUpload() {
        return {
            directory: this.getString('FILE_UPLOAD_DIRECTORY'),
            maxFileSizeBytes: this.getNumber('FILE_UPLOAD_MAX_FILE_SIZE_BYTES'),
            maxFilesPerUpload: this.getNumber('FILE_UPLOAD_MAX_FILES_PER_UPLOAD'),
            allowedMimeTypes: this.getString('FILE_UPLOAD_ALLOWED_FILE_TYPES').split(',')
        }
    }

    get clients() {
        return {
            applications: { port: this.getNumber('APPLICATIONS_CLIENT_PORT') },
            cores: { port: this.getNumber('CORES_CLIENT_PORT') },
            infrastructures: { port: this.getNumber('INFRASTRUCTURES_CLIENT_PORT') }
        }
    }
}
