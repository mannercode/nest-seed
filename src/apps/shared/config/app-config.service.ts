import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { BaseConfigService } from 'common'
import Joi from 'joi'

@Injectable()
export class AppConfigService extends BaseConfigService {
    static configSchema = Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),

        LOG_DIRECTORY: Joi.string().required(),
        LOG_DAYS_TO_KEEP: Joi.string().required(),
        LOG_FILE_LEVEL: Joi.string().required(),
        LOG_CONSOLE_LEVEL: Joi.string().required(),

        REDIS_PASSWORD: Joi.string().optional(),
        REDIS_HOST1: Joi.string().required(),
        REDIS_PORT1: Joi.number().required(),
        REDIS_HOST2: Joi.string().required(),
        REDIS_PORT2: Joi.number().required(),
        REDIS_HOST3: Joi.string().required(),
        REDIS_PORT3: Joi.number().required(),
        REDIS_HOST4: Joi.string().required(),
        REDIS_PORT4: Joi.number().required(),
        REDIS_HOST5: Joi.string().required(),
        REDIS_PORT5: Joi.number().required(),
        REDIS_HOST6: Joi.string().required(),
        REDIS_PORT6: Joi.number().required(),

        MONGO_REPLICA: Joi.string().required(),
        MONGO_USERNAME: Joi.string().required(),
        MONGO_PASSWORD: Joi.string().required(),
        MONGO_DATABASE: Joi.string().required(),
        MONGO_HOST1: Joi.string().required(),
        MONGO_PORT1: Joi.number().required(),
        MONGO_HOST2: Joi.string().required(),
        MONGO_PORT2: Joi.number().required(),
        MONGO_HOST3: Joi.string().required(),
        MONGO_PORT3: Joi.number().required(),

        HTTP_REQUEST_PAYLOAD_LIMIT: Joi.string().required(),
        HTTP_PAGINATION_DEFAULT_SIZE: Joi.number().required(),
        HTTP_PORT: Joi.number().required(),

        AUTH_ACCESS_SECRET: Joi.string().required(),
        AUTH_ACCESS_TOKEN_EXPIRATION: Joi.string().required(),
        AUTH_REFRESH_SECRET: Joi.string().required(),
        AUTH_REFRESH_TOKEN_EXPIRATION: Joi.string().required(),

        FILE_UPLOAD_DIRECTORY: Joi.string().required(),
        FILE_UPLOAD_MAX_FILE_SIZE_BYTES: Joi.number().required(),
        FILE_UPLOAD_MAX_FILES_PER_UPLOAD: Joi.number().required(),
        FILE_UPLOAD_ALLOWED_FILE_TYPES: Joi.string().required(),

        NATS_HOST1: Joi.string().required(),
        NATS_PORT1: Joi.number().required(),
        NATS_HOST2: Joi.string().required(),
        NATS_PORT2: Joi.number().required(),
        NATS_HOST3: Joi.string().required(),
        NATS_PORT3: Joi.number().required()
    })

    constructor(configService: ConfigService) {
        super(configService)
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
        const password = this.getString('REDIS_PASSWORD')
        const nodes = [
            { host: this.getString('REDIS_HOST1'), port: this.getNumber('REDIS_PORT1') },
            { host: this.getString('REDIS_HOST2'), port: this.getNumber('REDIS_PORT2') },
            { host: this.getString('REDIS_HOST3'), port: this.getNumber('REDIS_PORT3') },
            { host: this.getString('REDIS_HOST4'), port: this.getNumber('REDIS_PORT4') },
            { host: this.getString('REDIS_HOST5'), port: this.getNumber('REDIS_PORT5') },
            { host: this.getString('REDIS_HOST6'), port: this.getNumber('REDIS_PORT6') }
        ]

        return { password, nodes }
    }

    get nats() {
        const servers = [
            `nats://${this.getString('NATS_HOST1')}:${this.getNumber('NATS_PORT1')}`,
            `nats://${this.getString('NATS_HOST2')}:${this.getNumber('NATS_PORT2')}`,
            `nats://${this.getString('NATS_HOST3')}:${this.getNumber('NATS_PORT3')}`
        ]

        return { servers }
    }

    get mongo() {
        return {
            host1: `${this.getString('MONGO_HOST1')}:${this.getNumber('MONGO_PORT1')}`,
            host2: `${this.getString('MONGO_HOST2')}:${this.getNumber('MONGO_PORT2')}`,
            host3: `${this.getString('MONGO_HOST3')}:${this.getNumber('MONGO_PORT3')}`,
            replica: this.getString('MONGO_REPLICA'),
            user: this.getString('MONGO_USERNAME'),
            password: this.getString('MONGO_PASSWORD'),
            database: this.getString('MONGO_DATABASE')
        }
    }

    get http() {
        return {
            requestPayloadLimit: this.getString('HTTP_REQUEST_PAYLOAD_LIMIT'),
            paginationDefaultSize: this.getNumber('HTTP_PAGINATION_DEFAULT_SIZE'),
            port: this.getNumber('HTTP_PORT')
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

    get fileUpload() {
        return {
            directory: this.getString('FILE_UPLOAD_DIRECTORY'),
            maxFileSizeBytes: this.getNumber('FILE_UPLOAD_MAX_FILE_SIZE_BYTES'),
            maxFilesPerUpload: this.getNumber('FILE_UPLOAD_MAX_FILES_PER_UPLOAD'),
            allowedMimeTypes: this.getString('FILE_UPLOAD_ALLOWED_FILE_TYPES').split(',')
        }
    }
}
