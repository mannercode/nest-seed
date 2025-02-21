import { getRedisConnectionToken } from '@nestjs-modules/ioredis'
import { Controller, Get, Inject, Injectable, Module } from '@nestjs/common'
import { HealthCheckService, TerminusModule } from '@nestjs/terminus'
import { RedisHealthIndicator } from 'common'
import Redis from 'ioredis'
import { RedisConfig } from 'shared/config'

@Injectable()
class HealthService {
    constructor(
        private health: HealthCheckService,
        private redis: RedisHealthIndicator,
        @Inject(getRedisConnectionToken(RedisConfig.connName)) private redisConn: Redis
    ) {}

    check() {
        const checks = [async () => this.redis.isHealthy(RedisConfig.connName, this.redisConn)]

        return this.health.check(checks)
    }
}

@Controller()
class HealthController {
    constructor(private service: HealthService) {}

    @Get('health')
    health() {
        return this.service.check()
    }
}

@Module({
    imports: [TerminusModule],
    providers: [HealthService, RedisHealthIndicator],
    controllers: [HealthController]
})
export class HealthModule {}
