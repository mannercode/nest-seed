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

type LoginRole = 'admin' | 'user'

@Injectable()
export class LoginRateLimiterService {
    private readonly accountFailureLimit: number
    private readonly failureWindowMs: number
    private readonly ipFailureLimit: number
    private readonly counters: CacheService

    constructor(
        @Inject(getRedisConnectionToken(REDIS_CONNECTION_NAME))
        redis: RedisConnection,
        config: AppConfigService
    ) {
        this.accountFailureLimit = config.loginRateLimit.accountFailureLimit
        this.failureWindowMs = TimeUtil.toMs(config.loginRateLimit.failureWindow)
        this.ipFailureLimit = config.loginRateLimit.ipFailureLimit
        this.counters = new CacheService(redis, `login-rate-limit:${config.projectId}`)
    }

    async assertAllowed(role: LoginRole, email: string, ip: string): Promise<void> {
        const [accountFailures, ipFailures] = await Promise.all([
            this.getCount(this.getAccountKey(role, email)),
            this.getCount(this.getIpKey(ip))
        ])

        if (this.accountFailureLimit <= accountFailures || this.ipFailureLimit <= ipFailures) {
            this.throwRateLimited()
        }
    }

    async recordFailure(role: LoginRole, email: string, ip: string): Promise<void> {
        const [accountFailures, ipFailures] = await Promise.all([
            this.increment(this.getAccountKey(role, email)),
            this.increment(this.getIpKey(ip))
        ])

        // assertAllowed를 동시에 통과한 요청도 허용 횟수를 넘긴 순서부터 429로 끝낸다.
        if (this.accountFailureLimit < accountFailures || this.ipFailureLimit < ipFailures) {
            this.throwRateLimited()
        }
    }

    async resetAccount(role: LoginRole, email: string): Promise<void> {
        await this.counters.delete(this.getAccountKey(role, email))
    }

    private getAccountKey(role: LoginRole, email: string): string {
        return `account:${role}:${this.hash(email.trim().toLowerCase())}`
    }

    private async getCount(key: string): Promise<number> {
        return Number((await this.counters.get(key)) ?? 0)
    }

    private getIpKey(ip: string): string {
        return `ip:${this.hash(ip.trim().toLowerCase())}`
    }

    private hash(value: string): string {
        return sha256(value, 'base64url')
    }

    private async increment(key: string): Promise<number> {
        return this.counters.incrementWithExpiry(key, this.failureWindowMs)
    }

    private throwRateLimited(): never {
        throw new HttpException(AuthErrors.LoginRateLimited(), HttpStatus.TOO_MANY_REQUESTS)
    }
}
