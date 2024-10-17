import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Joi from 'joi'
import { getString } from './utils'

export const isEnv = (env: 'production' | 'development') => getString('NODE_ENV') === env

export const configSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production').required(),
    HTTP_REQUEST_PAYLOAD_LIMIT: Joi.string().required(),
    HTTP_PAGINATION_DEFAULT_SIZE: Joi.number().required(),
    AUTH_ACCESS_SECRET: Joi.string().required(),
    AUTH_ACCESS_TOKEN_EXPIRATION: Joi.string().required(),
    AUTH_REFRESH_SECRET: Joi.string().required(),
    AUTH_REFRESH_TOKEN_EXPIRATION: Joi.string().required(),
    LOG_DIRECTORY: Joi.string().required(),
    LOG_DAYS_TO_KEEP: Joi.string().required(),
    LOG_FILE_LEVEL: Joi.string().required(),
    LOG_CONSOLE_LEVEL: Joi.string().required(),
    REDIS_HOST: Joi.string().required(),
    REDIS_PORT: Joi.number().required(),
    MONGO_DB_HOST1: Joi.string().required(),
    MONGO_DB_HOST2: Joi.string().required(),
    MONGO_DB_HOST3: Joi.string().required(),
    MONGO_DB_PORT: Joi.number().required(),
    MONGO_DB_REPLICA_NAME: Joi.string().required(),
    MONGO_DB_USERNAME: Joi.string().required(),
    MONGO_DB_PASSWORD: Joi.string().required(),
    MONGO_DB_DATABASE: Joi.string().required(),
    FILE_UPLOAD_DIRECTORY: Joi.string().required(),
    FILE_UPLOAD_MAX_FILE_SIZE_BYTES: Joi.number().required(),
    FILE_UPLOAD_MAX_FILES_PER_UPLOAD: Joi.number().required(),
    FILE_UPLOAD_ALLOWED_FILE_TYPES: Joi.string().required()
})

@Injectable()
export class AppConfigService {
    constructor(private configService: ConfigService<{}, true>) {}

    get http() {
        return {
            requestPayloadLimit: this.getString('HTTP_REQUEST_PAYLOAD_LIMIT'),
            paginationDefaultSize: this.getNumber('HTTP_PAGINATION_DEFAULT_SIZE')
        }
    }
    get auth() {
        return {
            accessSecret: this.getString('AUTH_ACCESS_SECRET'),
            accessTokenExpiration: this.getString('AUTH_ACCESS_TOKEN_EXPIRATION'),
            refreshSecret: this.getString('AUTH_REFRESH_SECRET'),
            refreshTokenExpiration: this.getString('AUTH_REFRESH_TOKEN_EXPIRATION')
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
    get redis() {
        return {
            host: this.getString('REDIS_HOST'),
            port: this.getNumber('REDIS_PORT')
            // ttl: defaults to 5
        }
    }
    get mongo() {
        return {
            host1: this.getString('MONGO_DB_HOST1'),
            host2: this.getString('MONGO_DB_HOST2'),
            host3: this.getString('MONGO_DB_HOST3'),
            port: this.getNumber('MONGO_DB_PORT'),
            replica: this.getString('MONGO_DB_REPLICA_NAME'),
            user: this.getString('MONGO_DB_USERNAME'),
            pass: this.getString('MONGO_DB_PASSWORD'),
            database: this.getString('MONGO_DB_DATABASE')
        }
    }
    get fileUpload() {
        return {
            directory: this.getString('FILE_UPLOAD_DIRECTORY'),
            maxFileSizeBytes: this.getNumber('FILE_UPLOAD_MAX_FILE_SIZE_BYTES'),
            maxFilesPerUpload: this.getNumber('FILE_UPLOAD_MAX_FILES_PER_UPLOAD'),
            allowedMimeTypes: this.configService
                .get<string>('FILE_UPLOAD_ALLOWED_FILE_TYPES')
                .split(',')
        }
    }

    private validateKey(key: string) {
        if (!configSchema.describe().keys[key]) {
            console.error(
                `Configuration validation error: Key "${key}" is not defined in the configSchema`
            )
            process.exit(1)
        }
    }

    private getString(key: string): string {
        this.validateKey(key)
        return this.configService.get<string>(key)
    }

    private getNumber(key: string): number {
        this.validateKey(key)
        return this.configService.get<number>(key)
    }
}
