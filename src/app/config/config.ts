import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Joi from 'joi'

export const isEnv = (env: 'production' | 'development' | 'test') => process.env.NODE_ENV === env

export const configSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
    HTTP_REQUEST_PAYLOAD_LIMIT: Joi.string().required(),
    HTTP_PAGINATION_DEFAULT_SIZE: Joi.number().required(),
    CUSTOMER_AUTH_HOST: Joi.string().required(),
    CUSTOMER_AUTH_PORT: Joi.number().required(),
    CUSTOMER_AUTH_ACCESS_SECRET: Joi.string().required(),
    CUSTOMER_AUTH_ACCESS_TOKEN_EXPIRATION: Joi.string().required(),
    CUSTOMER_AUTH_REFRESH_SECRET: Joi.string().required(),
    CUSTOMER_AUTH_REFRESH_TOKEN_EXPIRATION: Joi.string().required(),
    LOG_DIRECTORY: Joi.string().required(),
    LOG_DAYS_TO_KEEP: Joi.string().required(),
    LOG_FILE_LEVEL: Joi.string().required(),
    LOG_CONSOLE_LEVEL: Joi.string().required(),
    QUEUE_HOST: Joi.string().required(),
    QUEUE_PORT: Joi.number().required(),
    TICKET_HOLDING_HOST: Joi.string().required(),
    TICKET_HOLDING_PORT: Joi.number().required(),
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
    get customerAuth() {
        return {
            host: this.getString('CUSTOMER_AUTH_HOST'),
            port: this.getNumber('CUSTOMER_AUTH_PORT'),
            accessSecret: this.getString('CUSTOMER_AUTH_ACCESS_SECRET'),
            accessTokenExpiration: this.getString('CUSTOMER_AUTH_ACCESS_TOKEN_EXPIRATION'),
            refreshSecret: this.getString('CUSTOMER_AUTH_REFRESH_SECRET'),
            refreshTokenExpiration: this.getString('CUSTOMER_AUTH_REFRESH_TOKEN_EXPIRATION')
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
    get queue() {
        return {
            host: this.getString('QUEUE_HOST'),
            port: this.getNumber('QUEUE_PORT')
            // ttl: defaults to 5
        }
    }
    get ticketHolding() {
        return {
            host: this.getString('TICKET_HOLDING_HOST'),
            port: this.getNumber('TICKET_HOLDING_PORT')
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
        /* istanbul ignore if */
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
