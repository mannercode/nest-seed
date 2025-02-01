import { Controller, Get, Inject, Injectable, Module } from '@nestjs/common'
import { MessagePattern } from '@nestjs/microservices'
import { HealthCheckService, TerminusModule } from '@nestjs/terminus'
import { RedisHealthIndicator, RedisModule } from 'common'
import Redis from 'ioredis'
import { RedisConfig } from 'shared/config'

@Injectable()
class HealthService {
    constructor(
        private health: HealthCheckService,
        private redis: RedisHealthIndicator,
        @Inject(RedisModule.getToken(RedisConfig.connName)) private redisConn: Redis
    ) {}

    check() {
        const checks = [async () => this.redis.pingCheck(RedisConfig.connName, this.redisConn)]

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

    @MessagePattern({ cmd: 'health' })
    method() {
        return { status: 'ok' }
    }
}

@Module({
    imports: [TerminusModule],
    providers: [HealthService, RedisHealthIndicator],
    controllers: [HealthController]
})
export class HealthModule {}
