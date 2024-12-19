import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { BaseConfigService } from 'common'
import Joi from 'joi'

export const isTest = () => process.env.NODE_ENV === 'test'

export const configSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
    AUTH_ACCESS_SECRET: Joi.string().required(),
    AUTH_ACCESS_TOKEN_EXPIRATION: Joi.string().required(),
    AUTH_REFRESH_SECRET: Joi.string().required(),
    AUTH_REFRESH_TOKEN_EXPIRATION: Joi.string().required(),
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
    INFRASTRUCTURES_CLIENT_PORT: Joi.number().required()
})

@Injectable()
export class CoresConfigService extends BaseConfigService {
    constructor(configService: ConfigService<object, true>) {
        super(configService, configSchema)
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

    get clients() {
        return {
            infrastructures: { port: this.getNumber('INFRASTRUCTURES_CLIENT_PORT') }
        }
    }
}
