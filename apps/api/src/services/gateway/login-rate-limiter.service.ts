import { getRedisConnectionToken, TimeUtil, type RedisConnection } from '@mannercode/common'
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common'
import { AppConfigService, REDIS_CONNECTION_NAME } from 'config'
import { createHash } from 'node:crypto'
import { AuthErrors } from './guards'

const INCREMENT_WITH_TTL_SCRIPT = `
    local count = redis.call('INCR', KEYS[1])
    if count == 1 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
    end
    return count
`

type LoginRole = 'admin' | 'user'

@Injectable()
export class LoginRateLimiterService {
    private readonly accountFailureLimit: number
    private readonly failureWindowMs: number
    private readonly ipFailureLimit: number
    private readonly prefix: string

    constructor(
        @Inject(getRedisConnectionToken(REDIS_CONNECTION_NAME))
        private readonly redis: RedisConnection,
        config: AppConfigService
    ) {
        this.accountFailureLimit = config.loginRateLimit.accountFailureLimit
        this.failureWindowMs = TimeUtil.toMs(config.loginRateLimit.failureWindow)
        this.ipFailureLimit = config.loginRateLimit.ipFailureLimit
        this.prefix = `login-rate-limit:${config.projectId}`
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
        await this.redis.del(this.getAccountKey(role, email))
    }

    private getAccountKey(role: LoginRole, email: string): string {
        return `${this.prefix}:account:${role}:${this.hash(email.trim().toLowerCase())}`
    }

    private async getCount(key: string): Promise<number> {
        return Number((await this.redis.get(key)) ?? 0)
    }

    private getIpKey(ip: string): string {
        return `${this.prefix}:ip:${this.hash(ip.trim().toLowerCase())}`
    }

    private hash(value: string): string {
        return createHash('sha256').update(value).digest('base64url')
    }

    private async increment(key: string): Promise<number> {
        const result = await this.redis.eval(
            INCREMENT_WITH_TTL_SCRIPT,
            1,
            key,
            this.failureWindowMs.toString()
        )
        return Number(result)
    }

    private throwRateLimited(): never {
        throw new HttpException(AuthErrors.LoginRateLimited(), HttpStatus.TOO_MANY_REQUESTS)
    }
}
