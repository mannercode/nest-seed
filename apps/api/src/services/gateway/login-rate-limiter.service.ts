import {
    CacheService,
    getRedisConnectionToken,
    sha256,
    TimeUtil,
    type RedisConnection
} from '@mannercode/common'
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common'
import { AppConfigService, REDIS_CONNECTION_NAME } from '#config'
import { AuthErrors } from './guards/index.js'

@Injectable()
export class LoginRateLimiterService {
    private readonly failureWindowMs: number
    private readonly ipFailureLimit: number
    private readonly counters: CacheService

    constructor(
        @Inject(getRedisConnectionToken(REDIS_CONNECTION_NAME)) redis: RedisConnection,
        config: AppConfigService
    ) {
        this.failureWindowMs = TimeUtil.toMs(config.loginRateLimit.failureWindow)
        this.ipFailureLimit = config.loginRateLimit.ipFailureLimit
        this.counters = new CacheService(redis, `login-rate-limit:${config.projectId}`)
    }

    async assertAllowed(ip: string): Promise<void> {
        const failures = Number((await this.counters.get(this.getIpKey(ip))) ?? 0)
        if (this.ipFailureLimit <= failures) this.throwRateLimited()
    }

    async recordFailure(ip: string): Promise<void> {
        const failures = await this.counters.incrementWithExpiry(
            this.getIpKey(ip),
            this.failureWindowMs
        )
        // 동시 요청이 사전 검사를 함께 통과해도 실패 횟수 증가 뒤 한도를 적용한다.
        if (this.ipFailureLimit < failures) this.throwRateLimited()
    }

    private getIpKey(ip: string): string {
        return `ip:${sha256(ip.trim().toLowerCase(), 'base64url')}`
    }

    private throwRateLimited(): never {
        throw new HttpException(AuthErrors.LoginRateLimited(), HttpStatus.TOO_MANY_REQUESTS)
    }
}
