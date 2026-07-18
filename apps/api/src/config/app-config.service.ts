import { BaseConfigService } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Joi from 'joi'

@Injectable()
export class AppConfigService extends BaseConfigService {
    static schema = Joi.object({
        AUTH_ACCESS_SECRET: Joi.string().min(20).required(),

        AUTH_ACCESS_TOKEN_EXPIRATION: Joi.string().required(),
        AUTH_ADMIN_ACCESS_SECRET: Joi.string().min(20).required(),
        AUTH_ADMIN_ACCESS_TOKEN_EXPIRATION: Joi.string().required(),
        AUTH_ADMIN_REFRESH_SECRET: Joi.string().min(20).required(),
        AUTH_ADMIN_REFRESH_TOKEN_EXPIRATION: Joi.string().required(),
        AUTH_AUDIENCE: Joi.string().required(),
        AUTH_ISSUER: Joi.string().required(),
        AUTH_REFRESH_SECRET: Joi.string().min(20).required(),
        AUTH_REFRESH_TOKEN_EXPIRATION: Joi.string().required(),
        ROOT_PASSWORD: Joi.string().min(8).required(),
        API_PORT: Joi.number().required(),
        HTTP_PAGINATION_DEFAULT_SIZE: Joi.number().required(),
        // 페이지 상한. 기본값(HTTP_PAGINATION_DEFAULT_SIZE)과 분리해, 기본값을 조정해도 상한이 따라 움직이지 않게 한다.
        HTTP_PAGINATION_MAX_SIZE: Joi.number().default(100),

        HTTP_REQUEST_PAYLOAD_LIMIT: Joi.string().required(),
        LOG_CONSOLE_LEVEL: Joi.string().required(),
        LOG_DAYS_TO_KEEP: Joi.string().required(),
        LOG_DIRECTORY: Joi.string().required(),
        LOG_FILE_LEVEL: Joi.string().required(),
        MONGO_URI: Joi.string().required(),
        MONGO_DATABASE: Joi.string().required(),
        NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
        REDIS_HOST1: Joi.string().required(),
        REDIS_HOST2: Joi.string().required(),
        REDIS_HOST3: Joi.string().required(),

        REDIS_PORT1: Joi.number().required(),
        REDIS_PORT2: Joi.number().required(),
        REDIS_PORT3: Joi.number().required(),

        NATS_HOST: Joi.string().required(),
        NATS_PORT: Joi.number().required(),

        TEMPORAL_HOST: Joi.string().required(),
        TEMPORAL_PORT: Joi.number().required(),
        TEMPORAL_NAMESPACE: Joi.string().required(),

        S3_ACCESS_KEY: Joi.string().required(),
        S3_BUCKET: Joi.string().required(),
        S3_ENDPOINT: Joi.string().required(),
        S3_FORCE_PATH_STYLE: Joi.boolean().required(),
        S3_REGION: Joi.string().required(),
        S3_SECRET_KEY: Joi.string().required(),

        PROJECT_ID: Joi.string().required(),

        ASSET_UPLOAD_EXPIRES_SEC: Joi.number().default(60 * 60),
        ASSET_DOWNLOAD_EXPIRES_SEC: Joi.number().default(60 * 60),
        TICKET_HOLD_DURATION_MS: Joi.number().default(10 * 60 * 1000),
        TICKET_MAX_PER_PURCHASE: Joi.number().default(10),
        TICKET_PRICE: Joi.number().default(10_000),
        TICKET_PURCHASE_CUTOFF_MINUTES: Joi.number().default(30)
    })

    get auth() {
        return {
            accessSecret: this.getString('AUTH_ACCESS_SECRET'),
            accessTokenExpiration: this.getString('AUTH_ACCESS_TOKEN_EXPIRATION'),
            audience: this.getString('AUTH_AUDIENCE'),
            issuer: this.getString('AUTH_ISSUER'),
            refreshSecret: this.getString('AUTH_REFRESH_SECRET'),
            refreshTokenExpiration: this.getString('AUTH_REFRESH_TOKEN_EXPIRATION')
        }
    }

    // user 토큰이 admin API를 통과하지 못하도록 별도의 서명 키를 쓴다.
    get adminAuth() {
        return {
            accessSecret: this.getString('AUTH_ADMIN_ACCESS_SECRET'),
            accessTokenExpiration: this.getString('AUTH_ADMIN_ACCESS_TOKEN_EXPIRATION'),
            audience: this.getString('AUTH_AUDIENCE'),
            issuer: this.getString('AUTH_ISSUER'),
            refreshSecret: this.getString('AUTH_ADMIN_REFRESH_SECRET'),
            refreshTokenExpiration: this.getString('AUTH_ADMIN_REFRESH_TOKEN_EXPIRATION')
        }
    }

    get root() {
        return { password: this.getString('ROOT_PASSWORD') }
    }

    get http() {
        return {
            paginationDefaultSize: this.getNumber('HTTP_PAGINATION_DEFAULT_SIZE'),
            paginationMaxSize: this.getNumber('HTTP_PAGINATION_MAX_SIZE'),
            port: this.getNumber('API_PORT'),
            requestPayloadLimit: this.getString('HTTP_REQUEST_PAYLOAD_LIMIT')
        }
    }

    get log() {
        return {
            consoleLogLevel: this.getString('LOG_CONSOLE_LEVEL'),
            daysToKeepLogs: this.getString('LOG_DAYS_TO_KEEP'),
            directory: this.getString('LOG_DIRECTORY'),
            fileLogLevel: this.getString('LOG_FILE_LEVEL')
        }
    }

    get mongo() {
        return { uri: this.getString('MONGO_URI'), dbName: this.getString('MONGO_DATABASE') }
    }

    get redis() {
        const nodes = [
            { host: this.getString('REDIS_HOST1'), port: this.getNumber('REDIS_PORT1') },
            { host: this.getString('REDIS_HOST2'), port: this.getNumber('REDIS_PORT2') },
            { host: this.getString('REDIS_HOST3'), port: this.getNumber('REDIS_PORT3') }
        ]

        return { nodes }
    }

    get nats() {
        return { servers: [`${this.getString('NATS_HOST')}:${this.getNumber('NATS_PORT')}`] }
    }

    get temporal() {
        return {
            address: `${this.getString('TEMPORAL_HOST')}:${this.getNumber('TEMPORAL_PORT')}`,
            namespace: this.getString('TEMPORAL_NAMESPACE')
        }
    }

    get s3() {
        return {
            bucket: this.getString('S3_BUCKET'),
            credentials: {
                accessKeyId: this.getString('S3_ACCESS_KEY'),
                secretAccessKey: this.getString('S3_SECRET_KEY')
            },
            endpoint: this.getString('S3_ENDPOINT'),
            forcePathStyle: this.getBoolean('S3_FORCE_PATH_STYLE'),
            region: this.getString('S3_REGION')
        }
    }

    get asset() {
        return {
            uploadExpiresInSec: this.getNumber('ASSET_UPLOAD_EXPIRES_SEC'),
            downloadExpiresInSec: this.getNumber('ASSET_DOWNLOAD_EXPIRES_SEC')
        }
    }

    get ticket() {
        return {
            holdDurationInMs: this.getNumber('TICKET_HOLD_DURATION_MS'),
            maxPerPurchase: this.getNumber('TICKET_MAX_PER_PURCHASE'),
            price: this.getNumber('TICKET_PRICE'),
            purchaseCutoffMinutes: this.getNumber('TICKET_PURCHASE_CUTOFF_MINUTES')
        }
    }

    // 명시하지 않으면 Nest가 부모 constructor의 주입 메타데이터를 읽지 못한다.
    constructor(configService: ConfigService) {
        super(configService)
    }
}
