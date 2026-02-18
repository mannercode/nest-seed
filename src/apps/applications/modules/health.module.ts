import { Controller, Get, Inject, Injectable, Module } from '@nestjs/common'
import { HealthCheckService } from '@nestjs/terminus'
import { TerminusModule } from '@nestjs/terminus'
import { RedisHealthIndicator } from 'common'
import Redis from 'ioredis'
import { RedisConfigModule } from 'shared'

@Injectable()
class HealthService {
    constructor(
        private readonly health: HealthCheckService,
        private readonly redis: RedisHealthIndicator,
        @Inject(RedisConfigModule.moduleName) private readonly redisConn: Redis
    ) {}

    check() {
        const checks = [async () => this.redis.isHealthy('redis', this.redisConn)]

        return this.health.check(checks)
    }
}

@Controller()
class HealthController {
    constructor(private readonly service: HealthService) {}

    @Get('health')
    health() {
        return this.service.check()
    }
}

@Module({
    controllers: [HealthController],
    imports: [TerminusModule],
    providers: [HealthService, RedisHealthIndicator]
})
export class HealthModule {}
