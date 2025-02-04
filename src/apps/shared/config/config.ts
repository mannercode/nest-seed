import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { BaseConfigService } from 'common'
import Joi from 'joi'

export const configSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
    LOG_DIRECTORY: Joi.string().required(),
    LOG_DAYS_TO_KEEP: Joi.string().required(),
    LOG_FILE_LEVEL: Joi.string().required(),
    LOG_CONSOLE_LEVEL: Joi.string().required(),
    REDIS_HOST1: Joi.string().required(),
    REDIS_HOST2: Joi.string().required(),
    REDIS_HOST3: Joi.string().required(),
    REDIS_HOST4: Joi.string().required(),
    REDIS_HOST5: Joi.string().required(),
    REDIS_HOST6: Joi.string().required(),
    REDIS_PASSWORD: Joi.string().optional(),
    REDIS_PORT: Joi.number().required(),
    MONGO_DB_HOST1: Joi.string().required(),
    MONGO_DB_HOST2: Joi.string().required(),
    MONGO_DB_HOST3: Joi.string().required(),
    MONGO_DB_PORT: Joi.number().required(),
    MONGO_DB_REPLICA_NAME: Joi.string().required(),
    MONGO_DB_USERNAME: Joi.string().required(),
    MONGO_DB_PASSWORD: Joi.string().required(),
    MONGO_DB_DATABASE: Joi.string().required(),
    HTTP_REQUEST_PAYLOAD_LIMIT: Joi.string().required(),
    HTTP_PAGINATION_DEFAULT_SIZE: Joi.number().required(),
    AUTH_ACCESS_SECRET: Joi.string().required(),
    AUTH_ACCESS_TOKEN_EXPIRATION: Joi.string().required(),
    AUTH_REFRESH_SECRET: Joi.string().required(),
    AUTH_REFRESH_TOKEN_EXPIRATION: Joi.string().required(),
    FILE_UPLOAD_DIRECTORY: Joi.string().required(),
    FILE_UPLOAD_MAX_FILE_SIZE_BYTES: Joi.number().required(),
    FILE_UPLOAD_MAX_FILES_PER_UPLOAD: Joi.number().required(),
    FILE_UPLOAD_ALLOWED_FILE_TYPES: Joi.string().required(),
    SERVICE_GATEWAY_HOST: Joi.string().required(),
    SERVICE_GATEWAY_PORT: Joi.number().required(),
    SERVICE_APPLICATIONS_HOST: Joi.string().required(),
    SERVICE_APPLICATIONS_PORT: Joi.number().required(),
    SERVICE_APPLICATIONS_HEALTH_PORT: Joi.number().required(),
    SERVICE_CORES_HOST: Joi.string().required(),
    SERVICE_CORES_PORT: Joi.number().required(),
    SERVICE_CORES_HEALTH_PORT: Joi.number().required(),
    SERVICE_INFRASTRUCTURES_HOST: Joi.string().required(),
    SERVICE_INFRASTRUCTURES_PORT: Joi.number().required(),
    SERVICE_INFRASTRUCTURES_HEALTH_PORT: Joi.number().required()
})

@Injectable()
export class AppConfigService extends BaseConfigService {
    constructor(configService: ConfigService<object, true>) {
        super(configService, configSchema)
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
        const hosts = [
            this.getString('REDIS_HOST1'),
            this.getString('REDIS_HOST2'),
            this.getString('REDIS_HOST3'),
            this.getString('REDIS_HOST4'),
            this.getString('REDIS_HOST5'),
            this.getString('REDIS_HOST6')
        ]
        const port = this.getNumber('REDIS_PORT')
        const password = this.getString('REDIS_PASSWORD')
        const nodes = hosts.map((host) => ({ host, port }))

        return { nodes, password }
    }
    get mongo() {
        return {
            host1: this.getString('MONGO_DB_HOST1'),
            host2: this.getString('MONGO_DB_HOST2'),
            host3: this.getString('MONGO_DB_HOST3'),
            port: this.getNumber('MONGO_DB_PORT'),
            replica: this.getString('MONGO_DB_REPLICA_NAME'),
            user: this.getString('MONGO_DB_USERNAME'),
            password: this.getString('MONGO_DB_PASSWORD'),
            database: this.getString('MONGO_DB_DATABASE')
        }
    }

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

    get fileUpload() {
        return {
            directory: this.getString('FILE_UPLOAD_DIRECTORY'),
            maxFileSizeBytes: this.getNumber('FILE_UPLOAD_MAX_FILE_SIZE_BYTES'),
            maxFilesPerUpload: this.getNumber('FILE_UPLOAD_MAX_FILES_PER_UPLOAD'),
            allowedMimeTypes: this.getString('FILE_UPLOAD_ALLOWED_FILE_TYPES').split(',')
        }
    }

    get services() {
        return {
            gateway: {
                host: this.getString('SERVICE_GATEWAY_HOST'),
                port: this.getNumber('SERVICE_GATEWAY_PORT')
            },
            applications: {
                host: this.getString('SERVICE_APPLICATIONS_HOST'),
                port: this.getNumber('SERVICE_APPLICATIONS_PORT'),
                healthPort: this.getNumber('SERVICE_APPLICATIONS_HEALTH_PORT')
            },
            cores: {
                host: this.getString('SERVICE_CORES_HOST'),
                port: this.getNumber('SERVICE_CORES_PORT'),
                healthPort: this.getNumber('SERVICE_CORES_HEALTH_PORT')
            },
            infrastructures: {
                host: this.getString('SERVICE_INFRASTRUCTURES_HOST'),
                port: this.getNumber('SERVICE_INFRASTRUCTURES_PORT'),
                healthPort: this.getNumber('SERVICE_INFRASTRUCTURES_HEALTH_PORT')
            }
        }
    }
}
