import { BaseConfigService } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Joi from 'joi'

@Injectable()
export class AppConfigService extends BaseConfigService {
    static schema = Joi.object({
        // 시크릿은 .env 기본값의 이름이 약속하는 대로 최소 20자를 강제한다. 짧은 값은 부팅에서 막는다.
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

        // `PROJECT_ID`는 모듈 평가 시점에 `getProjectId()`가 `process.env`에서 직접 읽는다.
        // 이 시점에는 NestJS DI와 Joi 검증이 아직 실행되지 않았으므로, `NestFactory.create` 단계에서도 같은 값을 다시 검증한다.
        PROJECT_ID: Joi.string().required(),

        // 도메인 정책 값이다. `.env`에서 비워 두면 아래 기본값으로 동작한다.
        // 운영 환경에서 조정할 일이 있을 때만 `.env`로 덮어쓴다.
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

    // admin은 사용자(user)와 토큰 신뢰 영역을 분리한다.
    // 같은 secret을 쓰면 user 토큰으로 admin API에 접근할 수 있어 권한 경계가 깨진다.
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

    // root는 DB 도큐먼트 없이 env 자격증명으로 인증되며 admin CRUD 권한만 가진다.
    // 콘텐츠 endpoint는 일반 admin만 통과한다.
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

    // NestJS DI는 child class에 명시적 constructor가 없으면 부모 constructor 파라미터의 메타데이터를 읽지 못한다.
    // 빈 위임처럼 보이지만 DI 동작에 꼭 필요하다.
    constructor(configService: ConfigService) {
        super(configService)
    }
}
