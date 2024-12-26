import { Controller, Get, Inject, Injectable, Module } from '@nestjs/common'
import { MessagePattern } from '@nestjs/microservices'
import { getConnectionToken } from '@nestjs/mongoose'
import { HealthCheckService, MongooseHealthIndicator, TerminusModule } from '@nestjs/terminus'
import {
    ClientProxyHealthIndicator,
    ClientProxyService,
    InjectClientProxy,
    RedisHealthIndicator,
    RedisModule
} from 'common'
import Redis from 'ioredis'
import mongoose from 'mongoose'
import { MongooseConfig, RedisConfig } from 'shared/config'

@Injectable()
class HealthService {
    constructor(
        private health: HealthCheckService,
        private mongoose: MongooseHealthIndicator,
        private redis: RedisHealthIndicator,
        @Inject(getConnectionToken(MongooseConfig.connName)) private mongoConn: mongoose.Connection,
        @Inject(RedisModule.getToken(RedisConfig.connName)) private redisConn: Redis,
        private proxyIndicator: ClientProxyHealthIndicator,
        @InjectClientProxy('INFRASTRUCTURES_CLIENT') private infaProxy: ClientProxyService
    ) {}

    check() {
        const checks = [
            async () =>
                this.mongoose.pingCheck(MongooseConfig.connName, { connection: this.mongoConn }),
            async () => this.redis.pingCheck(RedisConfig.connName, this.redisConn),
            async () => this.proxyIndicator.pingCheck('infrastructures_proxy', this.infaProxy)
        ]

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
    providers: [HealthService, RedisHealthIndicator, ClientProxyHealthIndicator],
    controllers: [HealthController]
})
export class HealthModule {}
