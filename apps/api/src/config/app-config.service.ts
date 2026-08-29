import { BaseConfigService } from '@mannercode/common'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { z } from 'zod'
import { PROJECT_ID_TOKEN } from './project-id.js'

const booleanFromEnvironment = z.union([
    z.boolean(),
    z
        .string()
        .trim()
        .pipe(z.stringbool({ falsy: ['false'], truthy: ['true'] }))
])
const decimalNumber = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i
const numberFromEnvironment = z.union([
    z.number().finite(),
    z.string().trim().regex(decimalNumber).transform(Number).pipe(z.number().finite())
])
const requiredString = z.string().min(1)

@Injectable()
export class AppConfigService extends BaseConfigService {
    static schema = z.object({
        AUTH_ACCESS_SECRET: z.string().min(20),

        AUTH_ACCESS_TOKEN_EXPIRATION: requiredString,
        AUTH_ADMIN_ACCESS_SECRET: z.string().min(20),
        AUTH_ADMIN_ACCESS_TOKEN_EXPIRATION: requiredString,
        AUTH_ADMIN_REFRESH_SECRET: z.string().min(20),
        AUTH_ADMIN_REFRESH_TOKEN_EXPIRATION: requiredString,
        AUTH_AUDIENCE: requiredString,
        AUTH_ISSUER: requiredString,
        AUTH_LOGIN_ACCOUNT_FAILURE_LIMIT: numberFromEnvironment
            .pipe(z.number().int().min(1))
            .default(5),
        AUTH_LOGIN_FAILURE_WINDOW: requiredString.default('15m'),
        AUTH_LOGIN_IP_FAILURE_LIMIT: numberFromEnvironment
            .pipe(z.number().int().min(1))
            .default(50),
        AUTH_REFRESH_SECRET: z.string().min(20),
        AUTH_REFRESH_TOKEN_EXPIRATION: requiredString,
        ROOT_PASSWORD: z.string().min(8),
        API_PORT: numberFromEnvironment,
        HTTP_PAGINATION_DEFAULT_SIZE: numberFromEnvironment,
        // 페이지 상한. 기본값(HTTP_PAGINATION_DEFAULT_SIZE)과 분리해, 기본값을 조정해도 상한이 따라 움직이지 않게 한다.
        HTTP_PAGINATION_MAX_SIZE: numberFromEnvironment.default(100),

        HTTP_REQUEST_PAYLOAD_LIMIT: requiredString,
        LOG_CONSOLE_LEVEL: requiredString,
        LOG_DAYS_TO_KEEP: requiredString,
        LOG_DIRECTORY: requiredString,
        LOG_FILE_LEVEL: requiredString,
        MONGO_URI: requiredString,
        MONGO_DATABASE: requiredString,
        NODE_ENV: z.enum(['development', 'production', 'test']),
        REDIS_HOST1: requiredString,
        REDIS_HOST2: requiredString,
        REDIS_HOST3: requiredString,

        REDIS_PORT1: numberFromEnvironment,
        REDIS_PORT2: numberFromEnvironment,
        REDIS_PORT3: numberFromEnvironment,

        NATS_HOST: requiredString,
        NATS_PORT: numberFromEnvironment,

        RESTATE_INGRESS_URL: z.url(),
        RESTATE_SERVICE_PORT: numberFromEnvironment.pipe(z.number().int().min(0).max(65_535)),

        S3_ACCESS_KEY: requiredString,
        S3_BUCKET: requiredString,
        S3_ENDPOINT: requiredString,
        S3_FORCE_PATH_STYLE: booleanFromEnvironment,
        S3_REGION: requiredString,
        S3_SECRET_KEY: requiredString,

        PROJECT_ID: requiredString,

        ASSET_UPLOAD_EXPIRES_SEC: numberFromEnvironment.default(60 * 60),
        ASSET_DOWNLOAD_EXPIRES_SEC: numberFromEnvironment.default(60 * 60),
        TICKET_HOLD_DURATION_MS: numberFromEnvironment.default(10 * 60 * 1000),
        TICKET_MAX_PER_PURCHASE: numberFromEnvironment.default(10),
        TICKET_PRICE: numberFromEnvironment.default(10_000),
        TICKET_PURCHASE_CUTOFF_MINUTES: numberFromEnvironment.default(30)
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

    get loginRateLimit() {
        return {
            accountFailureLimit: this.getNumber('AUTH_LOGIN_ACCOUNT_FAILURE_LIMIT'),
            failureWindow: this.getString('AUTH_LOGIN_FAILURE_WINDOW'),
            ipFailureLimit: this.getNumber('AUTH_LOGIN_IP_FAILURE_LIMIT')
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
            environment: this.getString('NODE_ENV'),
            fileLogLevel: this.getString('LOG_FILE_LEVEL'),
            serviceName: this.getString('PROJECT_ID')
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

    get restate() {
        return {
            ingressUrl: this.getString('RESTATE_INGRESS_URL'),
            servicePort: this.getNumber('RESTATE_SERVICE_PORT')
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
    constructor(
        configService: ConfigService,
        @Inject(PROJECT_ID_TOKEN) readonly projectId: string
    ) {
        super(configService)
    }
}
